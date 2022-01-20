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

import "../bank/Bank.sol";
import "./BitcoinTx.sol";
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

/// @title Bitcoin Bridge
/// @notice Bridge manages BTC deposit and redemption flow and is increasing and
///         decreasing balances in the Bank as a result of BTC deposit and
///         redemption operations performed by depositors and redeemers.
///
///         Depositors send BTC funds to the most recently created off-chain
///         ECDSA wallet of the bridge using pay-to-script-hash (P2SH) or
///         pay-to-witness-script-hash (P2WSH) containing hashed information
///         about the depositor’s Ethereum address. Then, the depositor reveals
///         their Ethereum address along with their deposit blinding factor,
///         refund public key hash and refund locktime to the Bridge on Ethereum
///         chain. The off-chain ECDSA wallet listens for these sorts of
///         messages and when it gets one, it checks the Bitcoin network to make
///         sure the deposit lines up. If it does, the off-chain ECDSA wallet
///         may decide to pick the deposit transaction for sweeping, and when
///         the sweep operation is confirmed on the Bitcoin network, the ECDSA
///         wallet informs the Bridge about the sweep increasing appropriate
///         balances in the Bank.
/// @dev Bridge is an upgradeable component of the Bank.
contract Bridge {
    using BTCUtils for bytes;
    using BTCUtils for uint256;
    using BytesLib for bytes;
    using ValidateSPV for bytes;
    using ValidateSPV for bytes32;

    /// @notice Represents data which must be revealed by the depositor during
    ///         deposit reveal.
    struct RevealInfo {
        // Index of the funding output belonging to the funding transaction.
        uint32 fundingOutputIndex;
        // Ethereum depositor address.
        address depositor;
        // The blinding factor as 8 bytes. Byte endianness doesn't matter
        // as this factor is not interpreted as uint.
        bytes8 blindingFactor;
        // The compressed Bitcoin public key (33 bytes and 02 or 03 prefix)
        // of the deposit's wallet hashed in the HASH160 Bitcoin opcode style.
        bytes20 walletPubKeyHash;
        // The compressed Bitcoin public key (33 bytes and 02 or 03 prefix)
        // that can be used to make the deposit refund after the refund
        // locktime passes. Hashed in the HASH160 Bitcoin opcode style.
        bytes20 refundPubKeyHash;
        // The refund locktime (4-byte LE). Interpreted according to locktime
        // parsing rules described in:
        // https://developer.bitcoin.org/devguide/transactions.html#locktime-and-sequence-number
        // and used with OP_CHECKLOCKTIMEVERIFY opcode as described in:
        // https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki
        bytes4 refundLocktime;
        // Address of the tBTC vault.
        address vault;
    }

    /// @notice Represents tBTC deposit data.
    struct DepositInfo {
        // Ethereum depositor address.
        address depositor;
        // Deposit amount in satoshi (8-byte LE). For example:
        // 0.0001 BTC = 10000 satoshi = 0x1027000000000000
        bytes8 amount;
        // UNIX timestamp the deposit was revealed at.
        uint32 revealedAt;
        // Address of the tBTC vault.
        address vault;
        // UNIX timestamp the deposit was swept at. Note this is not the
        // time when the deposit was swept on Bitcoin chain but actually
        // the time when the sweep proof was delivered on Ethereum chain.
        uint32 sweptAt;
    }

    /// @notice Represents an info about a sweep.
    struct SweepInfo {
        // Hash of the sweep transaction.
        bytes32 txHash;
        // Amount of the single transaction output.
        uint256 amount;
    }

    /// @notice Confirmations on the Bitcoin chain required to successfully
    ///         evaluate an SPV proof.
    uint256 public immutable txProofDifficultyFactor;

    /// @notice Address of the Bank this Bridge belongs to.
    Bank public immutable bank;

    /// TODO: Make it updatable
    /// @notice Handle to the Bitcoin relay.
    IRelay public immutable relay;

    /// @notice Collection of all unswept deposits indexed by
    ///         keccak256(fundingTxHash | fundingOutputIndex).
    ///         The fundingTxHash is LE bytes32 and fundingOutputIndex an uint8.
    ///         This mapping may contain valid and invalid deposits and the
    ///         wallet is responsible for validating them before attempting to
    ///         execute a sweep.
    ///
    /// TODO: Explore the possibility of storing just a hash of DepositInfo.
    mapping(uint256 => DepositInfo) public unswept;

    /// @notice Maps the wallet public key hash (computed using HASH160 opcode)
    ///         to the latest sweep.
    /// TODO: Explore the possibility of storing just a hash of SweepInfo.
    mapping(bytes20 => SweepInfo) public sweeps;

    event DepositRevealed(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex,
        address depositor,
        bytes8 blindingFactor,
        bytes20 walletPubKeyHash,
        bytes20 refundPubKeyHash,
        bytes4 refundLocktime
    );

    constructor(
        address _bank,
        address _relay,
        uint256 _txProofDifficultyFactor
    ) {
        require(_bank != address(0), "Bank address cannot be zero");
        bank = Bank(_bank);

        require(_relay != address(0), "Relay address cannot be zero");
        relay = IRelay(_relay);

        txProofDifficultyFactor = _txProofDifficultyFactor;
    }

    /// @notice Used by the depositor to reveal information about their P2(W)SH
    ///         Bitcoin deposit to the Bridge on Ethereum chain. The off-chain
    ///         wallet listens for revealed deposit events and may decide to
    ///         include the revealed deposit in the next executed sweep.
    ///         Information about the Bitcoin deposit can be revealed before or
    ///         after the Bitcoin transaction with P2(W)SH deposit is mined on
    ///         the Bitcoin chain. Worth noting, the gas cost of this function
    ///         scales with the number of P2(W)SH transaction inputs and
    ///         outputs.
    /// @param fundingTx Bitcoin funding transaction data, see `BitcoinTx.Info`
    /// @param reveal Deposit reveal data, see `RevealInfo struct
    /// @dev Requirements:
    ///      - `reveal.fundingOutputIndex` must point to the actual P2(W)SH
    ///        output of the BTC deposit transaction
    ///      - `reveal.depositor` must be the Ethereum address used in the
    ///        P2(W)SH BTC deposit transaction,
    ///      - `reveal.blindingFactor` must be the blinding factor used in the
    ///        P2(W)SH BTC deposit transaction,
    ///      - `reveal.walletPubKeyHash` must be the wallet pub key hash used in
    ///        the P2(W)SH BTC deposit transaction,
    ///      - `reveal.refundPubKeyHash` must be the refund pub key hash used in
    ///        the P2(W)SH BTC deposit transaction,
    ///      - `reveal.refundLocktime` must be the refund locktime used in the
    ///        P2(W)SH BTC deposit transaction,
    ///      - BTC deposit for the given `fundingTxHash`, `fundingOutputIndex`
    ///        can be revealed only one time.
    ///
    ///      If any of these requirements is not met, the wallet _must_ refuse
    ///      to sweep the deposit and the depositor has to wait until the
    ///      deposit script unlocks to receive their BTC back.
    function revealDeposit(
        BitcoinTx.Info calldata fundingTx,
        RevealInfo calldata reveal
    ) external {
        bytes memory expectedScript =
            abi.encodePacked(
                hex"14", // Byte length of depositor Ethereum address.
                reveal.depositor,
                hex"75", // OP_DROP
                hex"08", // Byte length of blinding factor value.
                reveal.blindingFactor,
                hex"75", // OP_DROP
                hex"76", // OP_DUP
                hex"a9", // OP_HASH160
                hex"14", // Byte length of a compressed Bitcoin public key hash.
                reveal.walletPubKeyHash,
                hex"87", // OP_EQUAL
                hex"63", // OP_IF
                hex"ac", // OP_CHECKSIG
                hex"67", // OP_ELSE
                hex"76", // OP_DUP
                hex"a9", // OP_HASH160
                hex"14", // Byte length of a compressed Bitcoin public key hash.
                reveal.refundPubKeyHash,
                hex"88", // OP_EQUALVERIFY
                hex"04", // Byte length of refund locktime value.
                reveal.refundLocktime,
                hex"b1", // OP_CHECKLOCKTIMEVERIFY
                hex"75", // OP_DROP
                hex"ac", // OP_CHECKSIG
                hex"68" // OP_ENDIF
            );

        bytes memory fundingOutput =
            fundingTx.outputVector.extractOutputAtIndex(
                reveal.fundingOutputIndex
            );
        bytes memory fundingOutputHash = fundingOutput.extractHash();

        if (fundingOutputHash.length == 20) {
            // A 20-byte output hash is used by P2SH. That hash is constructed
            // by applying OP_HASH160 on the locking script. A 20-byte output
            // hash is used as well by P2PKH and P2WPKH (OP_HASH160 on the
            // public key). However, since we compare the actual output hash
            // with an expected locking script hash, this check will succeed only
            // for P2SH transaction type with expected script hash value. For
            // P2PKH and P2WPKH, it will fail on the output hash comparison with
            // the expected locking script hash.
            require(
                keccak256(fundingOutputHash) ==
                    keccak256(expectedScript.hash160()),
                "Wrong 20-byte script hash"
            );
        } else if (fundingOutputHash.length == 32) {
            // A 32-byte output hash is used by P2WSH. That hash is constructed
            // by applying OP_HASH256 on the locking script.
            require(
                fundingOutputHash.toBytes32() == expectedScript.hash256(),
                "Wrong 32-byte script hash"
            );
        } else {
            revert("Wrong script hash length");
        }

        // Resulting TX hash is in native Bitcoin little-endian format.
        bytes32 fundingTxHash =
            abi
                .encodePacked(
                fundingTx
                    .version,
                fundingTx
                    .inputVector,
                fundingTx
                    .outputVector,
                fundingTx
                    .locktime
            )
                .hash256();

        DepositInfo storage deposit =
            unswept[
                uint256(
                    keccak256(
                        abi.encodePacked(
                            fundingTxHash,
                            reveal.fundingOutputIndex
                        )
                    )
                )
            ];
        require(deposit.revealedAt == 0, "Deposit already revealed");

        bytes8 fundingOutputAmount;
        /* solhint-disable-next-line no-inline-assembly */
        assembly {
            // First 8 bytes (little-endian) of the funding output represents
            // its value. To take the value, we need to jump over the first
            // word determining the array length, load the array, and trim it
            // by putting it to a bytes8.
            fundingOutputAmount := mload(add(fundingOutput, 32))
        }

        deposit.amount = fundingOutputAmount;
        deposit.depositor = reveal.depositor;
        /* solhint-disable-next-line not-rely-on-time */
        deposit.revealedAt = uint32(block.timestamp);
        deposit.vault = reveal.vault;

        emit DepositRevealed(
            fundingTxHash,
            reveal.fundingOutputIndex,
            reveal.depositor,
            reveal.blindingFactor,
            reveal.walletPubKeyHash,
            reveal.refundPubKeyHash,
            reveal.refundLocktime
        );
    }

    /// @notice Used by the wallet to prove the BTC deposit sweep transaction
    ///         and to update Bank balances accordingly. Sweep is only accepted
    ///         if it satisfies SPV proof.
    ///
    ///         The function is performing Bank balance updates by first
    ///         computing the Bitcoin fee for the sweep transaction. The fee is
    ///         divided evenly between all swept deposits. Each depositor
    ///         receives a balance in the bank equal to the amount inferred
    ///         during the reveal transaction, minus their fee share.
    ///
    ///         It is possible to prove the given sweep only one time.
    /// @param sweepTx Bitcoin sweep transaction data.
    /// @param sweepProof Bitcoin sweep proof data.
    /// TODO: List requirements in @dev section.
    function sweep(
        BitcoinTx.Info calldata sweepTx,
        BitcoinTx.Proof calldata sweepProof
    ) external {
        // The actual transaction proof is performed here. After that point, we
        // can assume the transaction happened on Bitcoin chain and has
        // a sufficient number of confirmations as determined by
        // `txProofDifficultyFactor` constant.
        bytes32 sweepTxHash = validateSweepTxProof(sweepTx, sweepProof);

        // Process sweep transaction output and extract its target wallet
        // public key hash and value.
        (bytes20 walletPubKeyHash, uint64 sweepTxOutputValue) =
            processSweepTxOutput(sweepTx);

        // Process sweep transaction inputs and extract their value sum and
        // all information needed to perform deposit bookkeeping.
        (
            uint256 sweepTxInputsValue,
            address[] memory depositors,
            uint256[] memory depositedAmounts
        ) = processSweepTxInputs(sweepTx, walletPubKeyHash);

        // Compute the sweep transaction fee which is a difference between
        // inputs amounts sum and the output amount.
        // TODO: Check fee against max fee.
        uint256 fee = sweepTxInputsValue - sweepTxOutputValue;
        // Calculate fee share by dividing the total fee by deposits count.
        // TODO: Deal with precision loss.
        uint256 feeShare = fee / depositedAmounts.length;
        // Reduce each deposit amount by fee share value.
        for (uint256 i = 0; i < depositedAmounts.length; i++) {
            // TODO: The feeShare can be bigger than the amount.
            depositedAmounts[i] -= feeShare;
        }

        // Record this sweep data and assign them to the wallet public key hash.
        sweeps[walletPubKeyHash] = SweepInfo(sweepTxHash, sweepTxOutputValue);

        // Update depositors balances in the Bank.
        bank.increaseBalances(depositors, depositedAmounts);

        // TODO: Handle deposits having `vault` set.
        // TODO: Emit an event.
        // TODO: Check for all possible edge cases and whether existing checks cover them.
    }

    // TODO: Documentation.
    function validateSweepTxProof(
        BitcoinTx.Info calldata sweepTx,
        BitcoinTx.Proof calldata sweepProof
    ) internal view returns (bytes32 sweepTxHash) {
        require(
            sweepTx.inputVector.validateVin(),
            "Invalid input vector provided"
        );
        require(
            sweepTx.outputVector.validateVout(),
            "Invalid output vector provided"
        );

        sweepTxHash = abi
            .encodePacked(
            sweepTx
                .version,
            sweepTx
                .inputVector,
            sweepTx
                .outputVector,
            sweepTx
                .locktime
        )
            .hash256();

        checkProofFromTxHash(sweepTxHash, sweepProof);

        return sweepTxHash;
    }

    // TODO: Documentation.
    function checkProofFromTxHash(
        bytes32 txHash,
        BitcoinTx.Proof calldata proof
    ) internal view {
        require(
            txHash.prove(
                proof.bitcoinHeaders.extractMerkleRootLE(),
                proof.merkleProof,
                proof.txIndexInBlock
            ),
            "Tx merkle proof is not valid for provided header and tx hash"
        );

        evaluateProofDifficulty(proof.bitcoinHeaders);
    }

    // TODO: Documentation.
    function evaluateProofDifficulty(bytes memory bitcoinHeaders)
        internal
        view
    {
        uint256 requestedDiff = 0;
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

        require(
            observedDiff >= requestedDiff * txProofDifficultyFactor,
            "Insufficient accumulated difficulty in header chain"
        );
    }

    // TODO: Documentation.
    function processSweepTxOutput(BitcoinTx.Info calldata sweepTx)
        internal
        pure
        returns (bytes20 walletPubKeyHash, uint64 value)
    {
        // To determine the total number of sweep transaction outputs, we need to
        // parse the compactSize uint (VarInt) the output vector is prepended by.
        // That compactSize uint encodes the number of vector elements using the
        // format presented in:
        // https://developer.bitcoin.org/reference/transactions.html#compactsize-unsigned-integers
        // We don't need asserting the compactSize uint is parseable since it
        // was already checked during `validateVout` validation.
        (, uint256 outputsCount) = sweepTx.outputVector.parseVarInt();
        require(
            outputsCount == 1,
            "Sweep transaction must have a single output"
        );

        bytes memory output = sweepTx.outputVector.extractOutputAtIndex(0);
        value = output.extractValue();
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

        return (walletPubKeyHash, value);
    }

    // TODO: Documentation.
    function processSweepTxInputs(
        BitcoinTx.Info calldata sweepTx,
        bytes20 walletPubKeyHash
    )
        internal
        returns (
            uint256 inputsValue,
            address[] memory depositors,
            uint256[] memory depositedAmounts
        )
    {
        SweepInfo storage previousSweep = sweeps[walletPubKeyHash];
        // Flag indicating whether the previous sweep transaction output
        // is included as an input. If current sweep is the first sweep
        // of given wallet, we use a shortcut and initialize it with `true`.
        bool previousSweepFlag = previousSweep.txHash == bytes32(0);

        // Determining the total number of sweep transaction inputs in the same
        // way as for number of outputs.
        (uint256 inputsCompactSizeUintLength, uint256 inputsCount) =
            sweepTx.inputVector.parseVarInt();

        // To determine the first input starting index, we must jump over
        // the compactSize uint which prepends the input vector. One byte must
        // be added because of how `parseVarInt` returns the length of the
        // compactSize uint. Refer `BTCUtils` library for more details.
        uint256 inputStartingIndex = 1 + inputsCompactSizeUintLength;

        // Determine the swept deposits count. If the `previousSweepFlag` is
        // already `true` that means the current sweep is the first one
        // for given wallet and we shouldn't expect an additional input. If
        // so, all inputs should be deposits. Otherwise, we need to subtract
        // one input since it represents a previous sweep output.
        uint256 depositsCount =
            previousSweepFlag ? inputsCount : inputsCount - 1;

        // Initialize helper variables.
        uint256 processedDepositsCount = 0;
        depositors = new address[](depositsCount);
        depositedAmounts = new uint256[](depositsCount);

        // Inputs processing loop.
        for (uint256 i = 0; i < inputsCount; i++) {
            // Check if we are at the end of the input vector.
            if (inputStartingIndex >= sweepTx.inputVector.length) {
                break;
            }

            (bytes memory input, uint256 inputLength) =
                extractTxInput(sweepTx, inputStartingIndex);

            // Extract the transaction hash corresponding to the given input.
            // Note that it's little-endian.
            bytes32 inputTxHash = input.extractInputTxIdLE();

            DepositInfo storage deposit =
                unswept[
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                inputTxHash,
                                BTCUtils.reverseUint32(
                                    uint32(input.extractTxIndexLE())
                                )
                            )
                        )
                    )
                ];

            if (deposit.revealedAt != 0) {
                // TODO: Check if we can make the replay protection cheaper.
                require(deposit.sweptAt == 0, "Deposit already swept");
                /* solhint-disable-next-line not-rely-on-time */
                deposit.sweptAt = uint32(block.timestamp);

                depositors[processedDepositsCount] = deposit.depositor;
                depositedAmounts[processedDepositsCount] = uint64(
                    abi
                        .encodePacked(deposit.amount)
                        .reverseEndianness()
                        .bytesToUint()
                );
                inputsValue += depositedAmounts[processedDepositsCount];

                processedDepositsCount++;
            } else if (
                !previousSweepFlag && previousSweep.txHash == inputTxHash
            ) {
                inputsValue += previousSweep.amount;
                previousSweepFlag = true;
            } else {
                revert("Unknown input type");
            }

            // Make the `inputStartingIndex` pointing to the next input by
            // increasing it by current input's length.
            inputStartingIndex += inputLength;
        }

        // Assert the previous sweep flag is true which means previous sweep
        // output was used as current sweep input or previous sweep has not
        // occurred at all.
        require(
            previousSweepFlag,
            "Previous sweep output not present in sweep transaction inputs"
        );

        return (inputsValue, depositors, depositedAmounts);
    }

    // TODO: Documentation. Mention that `txInfo` data should be validated outside.
    function extractTxInput(
        BitcoinTx.Info calldata txInfo,
        uint256 inputStartingIndex
    ) internal pure returns (bytes memory input, uint256 inputLength) {
        // First, determine the remaining vector using current input
        // starting index.
        bytes memory remainingVector =
            txInfo.inputVector.slice(
                inputStartingIndex,
                txInfo.inputVector.length - inputStartingIndex
            );

        // Determine the current input's length using the head of remaining
        // vector. We assume that the result of `determineInputLength` since
        // the whole function assumes the `txInfo` data is valid.
        inputLength = remainingVector.determineInputLength();

        // Extract the current input from remaining vector using calculated
        // input length.
        input = txInfo.inputVector.slice(inputStartingIndex, inputLength);

        return (input, inputLength);
    }

    // TODO It is possible a malicious wallet can sweep deposits that can not
    //      be later proved on Ethereum. For example, a deposit with
    //      an incorrect amount revealed. We need to provide a function for honest
    //      depositors, next to sweep, to prove their swept balances on Ethereum
    //      selectively, based on deposits they have earlier received.
    //      (UPDATE PR #90: Is it still the case since amounts are inferred?)
}
