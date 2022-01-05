// SPDX-License-Identifier: MIT

// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌

pragma solidity 0.8.4;

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";
import {
    ValidateSPV
} from "@keep-network/bitcoin-spv-sol/contracts/ValidateSPV.sol";

/// @title Interface for the Bitcoin relay
/// @notice Contains only the methods needed by tBTC v2. The Bitcoin relay
///         provides the difficulty of the previous and current epoch. One
///         difficulty epoch spans 2016 blocks.
interface IRelay {
    /// @notice Returns the difficulty of the current epoch.
    function getCurrentEpochDifficulty() external view returns (uint256);

    /// @notice Returns the difficulty of the previous epoch.
    function getPrevEpochDifficulty() external view returns (uint256);
}

/// TODO: Description
interface IBank {
    function increaseBalanceAndCall(
        address vault,
        address[] calldata depositors,
        uint256[] calldata depositedAmounts
    ) external;

    function increaseBalances(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external;
}

/// @title BTC Bridge
/// @notice Bridge manages BTC deposit and redemption and is increasing and
///         decreasing balances in the Bank as a result of BTC deposit and
///         redemption operations.
///
///         Depositors send BTC funds to the most-recently-created-wallet of the
///         bridge using pay-to-script-hash (P2SH) which contains hashed
///         information about the depositor’s minting Ethereum address. Then,
///         the depositor reveals their desired Ethereum minting address to the
///         Ethereum chain. The Bridge listens for these sorts of messages and
///         when it gets one, it checks the Bitcoin network to make sure the
///         funds line up. If they do, the off-chain wallet may decide to pick
///         this transaction for sweeping, and when the sweep operation is
///         confirmed on the Bitcoin network, the wallet informs the Bridge
///         about the sweep increasing appropriate balances in the Bank.
/// @dev Bridge is an upgradeable component of the Bank.
contract Bridge {
    using BTCUtils for uint256;
    using BTCUtils for bytes;
    using BytesLib for bytes;
    using ValidateSPV for bytes;
    using ValidateSPV for bytes32;

    struct DepositInfo {
        uint64 amount;
        address vault;
        uint32 revealedAt;
        uint32 sweptAt;
    }

    /// @notice Represents an info about a sweep.
    struct SweepInfo {
        // Hash of the sweep transaction.
        bytes32 txHash;
        // Amount of the single transaction output.
        uint256 amount;
    }

    /// @notice Confirmations on the Bitcoin chain
    uint256 public constant TX_PROOF_DIFFICULTY_FACTOR = 6;

    /// TODO: Check how checking of fee must be done
    /// @notice Maximum value of fee for the sweep transaction in satoshis.
    ///         The sweep transaction cannot exceed this amount.
    uint256 public constant MAX_TX_FEE = 2000;

    /// TODO: Make it updatable
    /// @notice Handle to the Bitcoin relay
    IRelay public immutable relay;

    /// TODO: Make it updatable
    /// @notice Handle to the Bitcoin relay
    IBank public immutable bank;

    /// @notice Collection of all unswept deposits indexed by
    ///         keccak256(fundingTxHash | fundingOutputIndex | depositorAddress).
    ///         This mapping may contain valid and invalid deposits and the
    ///         wallet is responsible for validating them before attempting to
    ///         execute a sweep.
    mapping(uint256 => DepositInfo) public unswept;

    /// @notice Maps the wallet public key hash (computed using HASH160 opcode)
    ///         to the latest sweep.
    /// TODO: Explore the possibility of storing just a hash of SweepInfo.
    mapping(bytes20 => SweepInfo) public sweeps;

    event DepositRevealed(
        uint256 depositId,
        bytes32 fundingTxHash,
        uint256 fundingOutputIndex,
        address depositor,
        uint64 blindingFactor,
        bytes refundPubKey,
        uint64 amount,
        address vault
    );

    constructor(address _relay, address _bank) {
        require(_relay != address(0), "Relay address cannot be zero");
        require(_bank != address(0), "Bank address cannot be zero");
        relay = IRelay(_relay);
        bank = IBank(_bank);
    }

    /// @notice Used by the depositor to reveal information about their P2SH
    ///         Bitcoin deposit to the Bridge on Ethereum chain. The off-chain
    ///         wallet listens for revealed deposit events and may decide to
    ///         include the revealed deposit in the next executed sweep.
    ///         Information about the Bitcoin deposit can be revealed before or
    ///         after the Bitcoin transaction with P2SH deposit is mined on the
    ///         Bitcoin chain.
    /// @param fundingTxHash The BTC transaction hash containing BTC P2SH
    ///        deposit funding transaction
    /// @param fundingOutputIndex The index of the transaction output in the
    ///        funding TX with P2SH deposit, max 256
    /// @param blindingFactor The blinding factor used in the BTC P2SH deposit,
    ///        max 2^64
    /// @param refundPubKey The refund pub key used in the BTC P2SH deposit
    /// @param amount The amount locked in the BTC P2SH deposit
    /// @param vault Bank vault to which the swept deposit should be routed
    /// @dev Requirements:
    ///      - `msg.sender` must be the Ethereum address used in the P2SH BTC deposit,
    ///      - `blindingFactor` must be the blinding factor used in the P2SH BTC deposit,
    ///      - `refundPubKey` must be the refund pub key used in the P2SH BTC deposit,
    ///      - `amount` must be the same as locked in the P2SH BTC deposit,
    ///      - BTC deposit for the given `fundingTxHash`, `fundingOutputIndex`
    ///        can be revealed by `msg.sender` only one time.
    ///
    ///      If any of these requirements is not met, the wallet _must_ refuse
    ///      to sweep the deposit and the depositor has to wait until the
    ///      deposit script unlocks to receive their BTC back.

    //TODO: Consider changing `fundingOutputIndex` it to uint16 or passing it
    //      as little endian bytes (for cheaper calculations).
    function revealDeposit(
        bytes32 fundingTxHash,
        uint256 fundingOutputIndex,
        uint64 blindingFactor,
        bytes calldata refundPubKey,
        uint64 amount,
        address vault
    ) external {
        uint256 depositId =
            uint256(
                keccak256(
                    abi.encode(fundingTxHash, fundingOutputIndex, msg.sender)
                )
            );

        DepositInfo storage deposit = unswept[depositId];
        require(deposit.revealedAt == 0, "Deposit already revealed");

        deposit.amount = amount;
        deposit.vault = vault;
        /* solhint-disable-next-line not-rely-on-time */
        deposit.revealedAt = uint32(block.timestamp);

        emit DepositRevealed(
            depositId,
            fundingTxHash,
            fundingOutputIndex,
            msg.sender,
            blindingFactor,
            refundPubKey,
            amount,
            vault
        );
    }

    /// @notice Used by the wallet to prove the BTC deposit sweep transaction
    ///         and to update Bank balances accordingly. Sweep is only accepted
    ///         if it satisfies SPV proof.
    ///
    ///         The function is performing Bank balance updates by first
    ///         computing the Bitcoin fee for the sweep transaction. The fee is
    ///         divided evenly between all swept deposits. Each depositor
    ///         receives a balance in the bank equal to the amount they have
    ///         declared during the reveal transaction, minus their fee share.
    ///
    ///         It is possible to prove the given sweep only one time.
    /// @param txVersion Transaction version number (4-byte LE)
    /// @param txInputVector All transaction inputs prepended by the number of
    ///                      inputs encoded as a compactSize uint, max 0xFC(252)
    ///                      inputs
    /// @param txOutputVector All transaction outputs prepended by the number
    ///                       of outputs encoded as a compactSize uint, max
    ///                       0xFC(252) outputs (Note: that there should be just
    ///                       a single output).
    /// @param txLocktime Final 4 bytes of the transaction
    /// @param merkleProof The merkle proof of transaction inclusion in a block
    /// @param txIndexInBlock Transaction index in the block (0-indexed)
    /// @param bitcoinHeaders Single bytestring of 80-byte bitcoin headers,
    ///                       lowest height first
    function sweep(
        bytes4 txVersion,
        bytes memory txInputVector,
        bytes memory txOutputVector,
        bytes4 txLocktime,
        bytes memory merkleProof,
        uint256 txIndexInBlock,
        bytes memory bitcoinHeaders
    ) external {
        require(txInputVector.validateVin(), "Invalid input vector provided");
        require(
            //TODO: Add a check - there should be just one output in the vector
            txOutputVector.validateVout(),
            "Invalid output vector provided"
        );
        bytes32 sweepTxHash =
            abi
                .encodePacked(
                txVersion,
                txInputVector,
                txOutputVector,
                txLocktime
            )
                .hash256();

        checkProofFromTxHash(
            sweepTxHash,
            merkleProof,
            txIndexInBlock,
            bitcoinHeaders
        );
        updateBalances(sweepTxHash, txInputVector, txOutputVector);

        // TODO It is possible a malicious wallet can sweep deposits that can not
        //      be later proved on Ethereum. For example, a deposit with
        //      an incorrect amount revealed. We need to provide a function for honest
        //      depositors, next to sweep, to prove their swept balances on Ethereum
        //      selectively, based on deposits they have earlier received.
    }

    function updateBalances(
        bytes32 sweepTxHash,
        bytes memory txInputVector,
        bytes memory txOutputVector
    ) internal {
        // We need to read `fundingTxHash`, `fundingOutputIndex` and
        // P2SH script depositor address from `txInputVector`.
        // We then hash them to obtain deposit identifier and read
        // DepositInfo. From DepositInfo we know what amount was declared
        // by the depositor in their reveal transaction and we use that
        // amount to update their Bank balance, minus fee.

        (bytes20 walletPubKeyHash, uint256 outputValue) =
            parseOutput(txOutputVector);
        SweepInfo storage previousSweep = sweeps[walletPubKeyHash];

        (, uint256 inputCounter) = BTCUtils.parseVarInt(txInputVector);

        uint256 sweptDepositsSum = 0;
        bool previousSweepTxOutputPresent = false;
        uint256 recipientNumber =
            previousSweep.txHash == bytes32(0)
                ? inputCounter
                : inputCounter - 1;
        address[] memory recipients = new address[](recipientNumber);
        uint256[] memory amounts = new uint256[](recipientNumber);

        for (uint256 i = 0; i < inputCounter; i++) {
            bytes memory input = txInputVector.extractInputAtIndex(i);
            bytes32 fundingTxHash = input.extractInputTxIdLE();

            if (fundingTxHash == previousSweep.txHash) {
                // input is funded by the previous sweep transaction output
                previousSweepTxOutputPresent = true;
            } else {
                // input comes from a deposit
                uint256 fundingOutputIndex = extractFundingOutputIndex(input);
                address depositorAddress = extractDepositorAddress(input);

                uint256 depositId =
                    uint256(
                        keccak256(
                            abi.encode(
                                fundingTxHash,
                                fundingOutputIndex,
                                depositorAddress
                            )
                        )
                    );

                DepositInfo storage deposit = unswept[depositId];
                require(deposit.revealedAt != 0, "Deposit not revealed");
                require(deposit.sweptAt == 0, "Deposit already swept");
                sweptDepositsSum += deposit.amount;
                recipients[i] = depositorAddress;
                amounts[i] = deposit.amount;

                // Delete deposit from unswept mapping or mark it as swept
                // depending on the gas costs. Alternatively, do not allow to
                // use the same TX input vector twice. Sweep should be provable
                // only one time.
                /* solhint-disable-next-line not-rely-on-time */
                deposit.sweptAt = uint32(block.timestamp);
            }
        }

        // One of the inputs must be the output of the previous sweep transaction
        // unless this is the very first sweep transaction
        require(
            previousSweep.txHash == bytes32(0) || previousSweepTxOutputPresent,
            "Previous sweep transaction output was not present"
        );

        // We need to validate if the sum in the output minus the
        // amount from the previous wallet balance input minus fees is
        // equal to the amount by which Bank balances were increased.
        uint256 fee = previousSweep.amount + sweptDepositsSum - outputValue;
        require(fee <= MAX_TX_FEE, "Sweep tx fee too high");

        // TODO: some precision maybe lost here - is it ok?
        uint256 deduction = fee / amounts.length;
        for (uint256 i = 0; i < amounts.length; i++) {
            amounts[i] -= deduction;
        }

        bank.increaseBalances(recipients, amounts);

        // Record this sweep data and assign them to the wallet public key hash.
        sweeps[walletPubKeyHash] = SweepInfo(sweepTxHash, outputValue);
    }

    function checkProofFromTxHash(
        bytes32 txHash,
        bytes memory merkleProof,
        uint256 txIndexInBlock,
        bytes memory bitcoinHeaders
    ) internal view {
        require(
            txHash.prove(
                bitcoinHeaders.extractMerkleRootLE(),
                merkleProof,
                txIndexInBlock
            ),
            "Tx merkle proof is not valid for provided header and tx hash"
        );
        evaluateProofDifficulty(bitcoinHeaders);
    }

    function evaluateProofDifficulty(bytes memory bitcoinHeaders)
        internal
        view
    {
        uint256 requestedDiff;
        uint256 currentDiff = relay.getCurrentEpochDifficulty();
        uint256 previousDiff = relay.getPrevEpochDifficulty();
        uint256 firstHeaderDiff =
            bitcoinHeaders.extractTarget().calculateDifficulty();

        if (firstHeaderDiff == currentDiff) {
            requestedDiff = currentDiff;
        } else if (firstHeaderDiff == previousDiff) {
            requestedDiff = previousDiff;
        } else {
            revert("Not at current or previous difficulty");
        }

        uint256 observedDiff = bitcoinHeaders.validateHeaderChain();

        require(
            observedDiff != ValidateSPV.getErrBadLength(),
            "Invalid length of the headers chain"
        );
        require(
            observedDiff != ValidateSPV.getErrInvalidChain(),
            "Invalid headers chain"
        );
        require(
            observedDiff != ValidateSPV.getErrLowWork(),
            "Insufficient work in a header"
        );

        //TODO: Commented due to testnet data which contains some blocks with
        //      difficulty set to 1.
        // require(
        //     observedDiff >= requestedDiff * TX_PROOF_DIFFICULTY_FACTOR,
        //     "Insufficient accumulated difficulty in header chain"
        // );
    }

    function extractFundingOutputIndex(bytes memory input)
        internal
        pure
        returns (uint256)
    {
        uint32 fundingOutputIndexLe = uint32(input.extractTxIndexLE());
        uint32 fundingOutputIndexBe = reverseUint32(fundingOutputIndexLe);
        return fundingOutputIndexBe;
    }

    function parseOutput(bytes memory txOutputVector)
        internal
        pure
        returns (bytes20 walletPubKeyHash, uint256 outputValue)
    {
        (, uint256 outputsCount) = txOutputVector.parseVarInt();
        require(
            outputsCount == 1,
            "Sweep transaction must have a single output"
        );
        bytes memory output = txOutputVector.extractOutputAtIndex(0);
        bytes memory walletPubKeyHashBytes = output.extractHash();
        // The sweep transaction output should always be P2PKH or P2WPKH.
        // In both cases, the wallet public key hash should be 20 bytes length.
        require(
            walletPubKeyHashBytes.length == 20,
            "Wallet public key hash should have 20 bytes"
        );
        /* solhint-disable-next-line no-inline-assembly */
        assembly {
            walletPubKeyHash := mload(add(walletPubKeyHashBytes, 32))
        }
        outputValue = output.extractValue();
    }

    function extractDepositorAddress(bytes memory input)
        internal
        pure
        returns (address)
    {
        bytes memory scriptSignature = input.extractScriptSig();

        // Script signature has the following format:
        // <signature> <public key> <redeemScript>.
        // The depositor address is 20 bytes long and is stored in the
        // `redeemScript`. The data that follows the depositor address has
        // constant length of 91 bytes.
        return scriptSignature.toAddress(scriptSignature.length - 91);
    }

    function reverseUint32(uint32 _b) internal pure returns (uint32 v) {
        v = _b;

        // swap bytes
        v = ((v >> 8) & 0x00FF00FF) | ((v & 0x00FF00FF) << 8);
        // swap 2-byte long pairs
        v = (v >> 16) | (v << 16);
    }
}
