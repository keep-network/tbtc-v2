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

import "@openzeppelin/contracts/access/Ownable.sol";

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";
import {
    ValidateSPV
} from "@keep-network/bitcoin-spv-sol/contracts/ValidateSPV.sol";

import "../bank/Bank.sol";
import "./BitcoinTx.sol";

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
contract Bridge is Ownable {
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
        // Address of the Bank vault to which the deposit is routed to.
        // Optional, can be 0x0. The vault must be trusted by the Bridge.
        address vault;
    }

    /// @notice Represents tBTC deposit data.
    struct DepositRequest {
        // Ethereum depositor address.
        address depositor;
        // Deposit amount in satoshi.
        uint64 amount;
        // UNIX timestamp the deposit was revealed at.
        uint32 revealedAt;
        // Address of the Bank vault the deposit is routed to.
        // Optional, can be 0x0.
        address vault;
        // UNIX timestamp the deposit was swept at. Note this is not the
        // time when the deposit was swept on the Bitcoin chain but actually
        // the time when the sweep proof was delivered to the Ethereum chain.
        uint32 sweptAt;
    }

    /// @notice Represents a redemption request.
    struct RedemptionRequest {
        // ETH address of the redeemer who created the request.
        address redeemer;
        // Requested TBTC amount in satoshi.
        uint64 requestedAmount;
        // Treasury TBTC fee in satoshi at the moment of request creation.
        uint64 treasuryFee;
        // Transaction maximum BTC fee in satoshi at the moment of request
        // creation.
        uint64 txMaxFee;
        // UNIX timestamp the request was created at.
        uint32 requestedAt;
    }

    /// @notice Represents an outcome of the redemption Bitcoin transaction
    ///         outputs processing.
    struct RedemptionTxOutputsInfo {
        // Total TBTC value in satoshi that should be burned by the Bridge.
        uint64 totalBurnableValue;
        // Total TBTC value in satoshi that should be transferred to
        // the treasury.
        uint64 totalTreasuryFee;
        // Index of the change output.
        uint32 changeIndex;
        // Value in satoshi of the change output.
        uint64 changeValue;
    }

    /// @notice Represents wallet state:
    ///         - Unknown: the wallet is unknown to the Bridge
    ///         - Active: the wallet can sweep deposits and accept redemption
    ///           requests
    ///         - MovingFunds: the wallet was deemed unhealthy and is only
    ///           expected to move their outstanding funds to another wallet.
    ///           No other actions are possible.
    ///         - Closed: the wallet cannot perform any action
    enum WalletState {Unknown, Active, MovingFunds, Closed}

    /// @notice Holds information about a wallet.
    struct Wallet {
        // Current state of the wallet.
        WalletState state;
        // The total redeemable value of pending redemption requests targeting
        // that wallet.
        uint64 pendingRedemptionsValue;
    }

    /// @notice The number of confirmations on the Bitcoin chain required to
    ///         successfully evaluate an SPV proof.
    uint256 public immutable txProofDifficultyFactor;

    /// TODO: Revisit whether it should be governable or not.
    /// @notice Address of the Bank this Bridge belongs to.
    Bank public immutable bank;

    /// TODO: Make it governable.
    /// @notice Handle to the Bitcoin relay.
    IRelay public immutable relay;

    /// TODO: Revisit whether it should be governable or not.
    /// @notice Address where the redemptions treasury fees will be sent to.
    address public immutable treasury;

    /// TODO: Make it governable.
    /// @notice The minimal amount that can be requested for redemption.
    ///         Value of this parameter should be always bigger than the sum
    ///         of `redemptionTreasuryFee` and `redemptionTxMaxFee` to make
    ///         redemptions possible.
    uint64 public redemptionDustThreshold;

    /// TODO: Make it governable.
    /// @notice Amount of TBTC that is taken from each redemption request and
    ///         transferred to the treasury upon successful request finalization.
    uint64 public redemptionTreasuryFee;

    /// TODO: Make it governable.
    /// @notice Maximum amount of BTC transaction fee that can be incurred by
    ///         each redemption request being part of given redemption
    ///         transaction.
    uint64 public redemptionTxMaxFee;

    /// TODO: Make it governable.
    /// @notice Time after which the redemption request can be reported as
    ///         timed out. It is counted from the moment when the redemption
    ///         request was created via `requestRedemption` call. Reported
    ///         timed out requests are cancelled and locked TBTC is returned
    ///         to the redeemer in full amount.
    uint256 public redemptionTimeout;

    /// @notice Indicates if the vault with the given address is trusted or not.
    ///         Depositors can route their revealed deposits only to trusted
    ///         vaults and have trusted vaults notified about new deposits as
    ///         soon as these deposits get swept. Vaults not trusted by the
    ///         Bridge can still be used by Bank balance owners on their own
    ///         responsibility - anyone can approve their Bank balance to any
    ///         address.
    mapping(address => bool) public isVaultTrusted;

    /// @notice Collection of all revealed deposits indexed by
    ///         keccak256(fundingTxHash | fundingOutputIndex).
    ///         The fundingTxHash is LE bytes32 and fundingOutputIndex an uint32.
    ///         This mapping may contain valid and invalid deposits and the
    ///         wallet is responsible for validating them before attempting to
    ///         execute a sweep.
    mapping(uint256 => DepositRequest) public deposits;

    /// @notice Maps the 20-byte wallet public key hash (computed using HASH160
    ///         opcode) to the latest wallet's main UTXO computed as
    ///         keccak256(txHash | txOutputIndex | txOutputValue). The `tx`
    ///         prefix refers to the transaction which created that main UTXO.
    ///         The txHash is LE bytes32, txOutputIndex an uint32, and
    ///         txOutputValue an uint64 value.
    mapping(bytes20 => bytes32) public mainUtxos;

    /// @notice Collection of all pending redemption requests indexed by
    ///         redemption key built as
    ///         keccak256(walletPubKeyHash | redeemerOutputHash). The
    ///         walletPubKeyHash is the 20-byte wallet's public key hash
    ///         (computed using HASH160 opcode) and redeemerOutputHash is the
    ///         20-byte (P2PKH, P2WPKH or P2SH) or 32-byte (P2WSH) output
    ///         hash that will be used to lock redeemed BTC as requested by
    ///         the redeemer. Requests are added to this mapping by the
    ///         `requestRedemption` method (duplicates not allowed) and are
    ///         removed by one of the following methods:
    ///         - `submitRedemptionProof` in case the request was handled
    ///           successfully
    ///         - `notifyRedemptionTimeout` in case the request was reported
    ///           to be timed out
    ///         - `submitRedemptionFraudProof` in case the request was handled
    ///           in an incorrect way amount-wise.
    mapping(uint256 => RedemptionRequest) public pendingRedemptionRequests;

    /// @notice Collection of all redemption faults indexed by redemption key
    ///         built as keccak256(walletPubKeyHash | redeemerOutputHash). The
    ///         walletPubKeyHash is the 20-byte wallet's public key hash
    ///         (computed using HASH160 opcode) and redeemerOutputHash is the
    ///         20-byte (P2PKH, P2WPKH or P2SH) or 32-byte (P2WSH) output
    ///         hash that is involved in the fault. Two methods can add
    ///         to this mapping:
    ///         - `notifyRedemptionTimeout` which puts the redemption key
    ///           to this mapping basing on a timed out request stored
    ///           previously in `pendingRedemptionRequests` mapping.
    ///         - `submitRedemptionFraudProof` which puts the redemption key
    ///           to this mapping basing on a misfunded request stored
    ///           previously in `pendingRedemptionRequests` mapping or
    ///           basing on a non-requested arbitrary redemption performed
    ///           by the wallet.
    ///
    // TODO: Remove that Slither disable once this variable is used.
    // slither-disable-next-line uninitialized-state
    mapping(uint256 => bool) public redemptionFaults;

    /// @notice Maps the 20-byte wallet public key hash (computed using HASH160
    ///         opcode) to the basic wallet information like state and
    ///         pending redemptions value.
    ///
    // TODO: Remove that Slither disable once this variable is used.
    // slither-disable-next-line uninitialized-state
    mapping(bytes20 => Wallet) public wallets;

    event VaultStatusUpdated(address indexed vault, bool isTrusted);

    event DepositRevealed(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex,
        address depositor,
        uint64 amount,
        bytes8 blindingFactor,
        bytes20 walletPubKeyHash,
        bytes20 refundPubKeyHash,
        bytes4 refundLocktime,
        address vault
    );

    event DepositsSwept(bytes20 walletPubKeyHash, bytes32 sweepTxHash);

    event RedemptionRequested(
        bytes20 walletPubKeyHash,
        bytes redeemerOutputHash,
        address redeemer,
        uint64 requestedAmount,
        uint64 treasuryFee,
        uint64 txMaxFee
    );

    event RedemptionsPerformed(
        bytes20 walletPubKeyHash,
        bytes32 redemptionTxHash
    );

    constructor(
        address _bank,
        address _relay,
        address _treasury,
        uint256 _txProofDifficultyFactor
    ) {
        require(_bank != address(0), "Bank address cannot be zero");
        bank = Bank(_bank);

        require(_relay != address(0), "Relay address cannot be zero");
        relay = IRelay(_relay);

        require(_treasury != address(0), "Treasury address cannot be zero");
        treasury = _treasury;

        txProofDifficultyFactor = _txProofDifficultyFactor;

        // TODO: Revisit initial values.
        redemptionDustThreshold = 1000000; // 1000000 satoshi = 0.01 BTC
        redemptionTreasuryFee = 100000; // 100000 satoshi
        redemptionTxMaxFee = 1000; // 1000 satoshi
        redemptionTimeout = 172800; // 48 hours
    }

    /// @notice Allows the Governance to mark the given vault address as trusted
    ///         or no longer trusted. Vaults are not trusted by default.
    ///         Trusted vault must meet the following criteria:
    ///         - `IVault.receiveBalanceIncrease` must have a known, low gas
    ///           cost.
    ///         - `IVault.receiveBalanceIncrease` must never revert.
    /// @dev Without restricting reveal only to trusted vaults, malicious
    ///      vaults not meeting the criteria would be able to nuke sweep proof
    ///      transactions executed by ECDSA wallet with  deposits routed to
    ///      them.
    /// @param vault The address of the vault
    /// @param isTrusted flag indicating whether the vault is trusted or not
    /// @dev Can only be called by the Governance.
    function setVaultStatus(address vault, bool isTrusted) external onlyOwner {
        isVaultTrusted[vault] = isTrusted;
        emit VaultStatusUpdated(vault, isTrusted);
    }

    /// @notice Used by the depositor to reveal information about their P2(W)SH
    ///         Bitcoin deposit to the Bridge on Ethereum chain. The off-chain
    ///         wallet listens for revealed deposit events and may decide to
    ///         include the revealed deposit in the next executed sweep.
    ///         Information about the Bitcoin deposit can be revealed before or
    ///         after the Bitcoin transaction with P2(W)SH deposit is mined on
    ///         the Bitcoin chain. Worth noting, the gas cost of this function
    ///         scales with the number of P2(W)SH transaction inputs and
    ///         outputs. The deposit may be routed to one of the trusted vaults.
    ///         When a deposit is routed to a vault, vault gets notified when
    ///         the deposit gets swept and it may execute the appropriate action.
    /// @param fundingTx Bitcoin funding transaction data, see `BitcoinTx.Info`
    /// @param reveal Deposit reveal data, see `RevealInfo struct
    /// @dev Requirements:
    ///      - `reveal.vault` must be 0x0 or point to a trusted vault
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
        require(
            reveal.vault == address(0) || isVaultTrusted[reveal.vault],
            "Vault is not trusted"
        );

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
                fundingOutputHash.slice20(0) == expectedScript.hash160View(),
                "Wrong 20-byte script hash"
            );
        } else if (fundingOutputHash.length == 32) {
            // A 32-byte output hash is used by P2WSH. That hash is constructed
            // by applying OP_SHA256 on the locking script.
            require(
                fundingOutputHash.toBytes32() == sha256(expectedScript),
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
                .hash256View();

        DepositRequest storage deposit =
            deposits[
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

        uint64 fundingOutputAmount = fundingOutput.extractValue();

        // TODO: Check the amount against the dust threshold.

        deposit.amount = fundingOutputAmount;
        deposit.depositor = reveal.depositor;
        /* solhint-disable-next-line not-rely-on-time */
        deposit.revealedAt = uint32(block.timestamp);
        deposit.vault = reveal.vault;

        emit DepositRevealed(
            fundingTxHash,
            reveal.fundingOutputIndex,
            reveal.depositor,
            fundingOutputAmount,
            reveal.blindingFactor,
            reveal.walletPubKeyHash,
            reveal.refundPubKeyHash,
            reveal.refundLocktime,
            reveal.vault
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
    /// @param sweepTx Bitcoin sweep transaction data
    /// @param sweepProof Bitcoin sweep proof data
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain. If no main UTXO exists for the given wallet,
    ///        this parameter is ignored
    /// @dev Requirements:
    ///      - `sweepTx` components must match the expected structure. See
    ///        `BitcoinTx.Info` docs for reference. Their values must exactly
    ///        correspond to appropriate Bitcoin transaction fields to produce
    ///        a provable transaction hash.
    ///      - The `sweepTx` should represent a Bitcoin transaction with 1..n
    ///        inputs. If the wallet has no main UTXO, all n inputs should
    ///        correspond to P2(W)SH revealed deposits UTXOs. If the wallet has
    ///        an existing main UTXO, one of the n inputs must point to that
    ///        main UTXO and remaining n-1 inputs should correspond to P2(W)SH
    ///        revealed deposits UTXOs. That transaction must have only
    ///        one P2(W)PKH output locking funds on the 20-byte wallet public
    ///        key hash.
    ///      - `sweepProof` components must match the expected structure. See
    ///        `BitcoinTx.Proof` docs for reference. The `bitcoinHeaders`
    ///        field must contain a valid number of block headers, not less
    ///        than the `txProofDifficultyFactor` contract constant.
    ///      - `mainUtxo` components must point to the recent main UTXO
    ///        of the given wallet, as currently known on the Ethereum chain.
    ///        If there is no main UTXO, this parameter is ignored.
    function submitSweepProof(
        BitcoinTx.Info calldata sweepTx,
        BitcoinTx.Proof calldata sweepProof,
        BitcoinTx.UTXO calldata mainUtxo
    ) external {
        // TODO: Fail early if the function call gets frontrunned. See discussion:
        //       https://github.com/keep-network/tbtc-v2/pull/106#discussion_r801745204

        // The actual transaction proof is performed here. After that point, we
        // can assume the transaction happened on Bitcoin chain and has
        // a sufficient number of confirmations as determined by
        // `txProofDifficultyFactor` constant.
        bytes32 sweepTxHash = validateBitcoinTxProof(sweepTx, sweepProof);

        // Process sweep transaction output and extract its target wallet
        // public key hash and value.
        (bytes20 walletPubKeyHash, uint64 sweepTxOutputValue) =
            processSweepTxOutput(sweepTx.outputVector);

        // TODO: Validate if `walletPubKeyHash` is a known and active wallet.

        // Check if the main UTXO for given wallet exists. If so, validate
        // passed main UTXO data against the stored hash and use them for
        // further processing. If no main UTXO exists, use empty data.
        BitcoinTx.UTXO memory resolvedMainUtxo =
            BitcoinTx.UTXO(bytes32(0), 0, 0);
        bytes32 mainUtxoHash = mainUtxos[walletPubKeyHash];
        if (mainUtxoHash != bytes32(0)) {
            require(
                keccak256(
                    abi.encodePacked(
                        mainUtxo.txHash,
                        mainUtxo.txOutputIndex,
                        mainUtxo.txOutputValue
                    )
                ) == mainUtxoHash,
                "Invalid main UTXO data"
            );
            resolvedMainUtxo = mainUtxo;
        }

        // Process sweep transaction inputs and extract their value sum and
        // all information needed to perform deposit bookkeeping.
        (
            uint256 sweepTxInputsValue,
            address[] memory depositors,
            uint256[] memory depositedAmounts
        ) = processSweepTxInputs(sweepTx.inputVector, resolvedMainUtxo);

        // Compute the sweep transaction fee which is a difference between
        // inputs amounts sum and the output amount.
        // TODO: Check fee against max fee.
        uint256 fee = sweepTxInputsValue - sweepTxOutputValue;
        // Calculate fee share by dividing the total fee by deposits count.
        // TODO: Deal with precision loss by having the last depositor pay
        //       the higher fee than others if there is a change, just like it has
        //       been proposed for the redemption flow. See:
        //       https://github.com/keep-network/tbtc-v2/pull/128#discussion_r800555359.
        uint256 feeShare = fee / depositedAmounts.length;
        // Reduce each deposit amount by fee share value.
        for (uint256 i = 0; i < depositedAmounts.length; i++) {
            // We don't have to check if `feeShare` is bigger than the amount
            // since we have the dust threshold preventing against too small
            // deposits amounts.
            depositedAmounts[i] -= feeShare;
        }

        // Record this sweep data and assign them to the wallet public key hash
        // as new main UTXO. Transaction output index is always 0 as sweep
        // transaction always contains only one output.
        mainUtxos[walletPubKeyHash] = keccak256(
            abi.encodePacked(sweepTxHash, uint32(0), sweepTxOutputValue)
        );

        emit DepositsSwept(walletPubKeyHash, sweepTxHash);

        // Update depositors balances in the Bank.
        bank.increaseBalances(depositors, depositedAmounts);

        // TODO: Handle deposits having `vault` set.
    }

    /// @notice Validates the SPV proof of the Bitcoin transaction.
    ///         Reverts in case the validation or proof verification fail.
    /// @param txInfo Bitcoin transaction data
    /// @param proof Bitcoin proof data
    /// @return txHash Proven 32-byte transaction hash.
    function validateBitcoinTxProof(
        BitcoinTx.Info calldata txInfo,
        BitcoinTx.Proof calldata proof
    ) internal view returns (bytes32 txHash) {
        require(
            txInfo.inputVector.validateVin(),
            "Invalid input vector provided"
        );
        require(
            txInfo.outputVector.validateVout(),
            "Invalid output vector provided"
        );

        txHash = abi
            .encodePacked(
            txInfo
                .version,
            txInfo
                .inputVector,
            txInfo
                .outputVector,
            txInfo
                .locktime
        )
            .hash256View();

        checkProofFromTxHash(txHash, proof);

        return txHash;
    }

    /// @notice Checks the given Bitcoin transaction hash against the SPV proof.
    ///         Reverts in case the check fails.
    /// @param txHash 32-byte hash of the checked Bitcoin transaction
    /// @param proof Bitcoin proof data
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

    /// @notice Evaluates the given Bitcoin proof difficulty against the actual
    ///         Bitcoin chain difficulty provided by the relay oracle.
    ///         Reverts in case the evaluation fails.
    /// @param bitcoinHeaders Bitcoin headers chain being part of the SPV
    ///        proof. Used to extract the observed proof difficulty
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

    /// @notice Processes the Bitcoin sweep transaction output vector by
    ///         extracting the single output and using it to gain additional
    ///         information required for further processing (e.g. value and
    ///         wallet public key hash).
    /// @param sweepTxOutputVector Bitcoin sweep transaction output vector.
    ///        This function assumes vector's structure is valid so it must be
    ///        validated using e.g. `BTCUtils.validateVout` function before
    ///        it is passed here
    /// @return walletPubKeyHash 20-byte wallet public key hash.
    /// @return value 8-byte sweep transaction output value.
    function processSweepTxOutput(bytes memory sweepTxOutputVector)
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
        // See `BitcoinTx.outputVector` docs for more details.
        (, uint256 outputsCount) = sweepTxOutputVector.parseVarInt();
        require(
            outputsCount == 1,
            "Sweep transaction must have a single output"
        );

        bytes memory output = sweepTxOutputVector.extractOutputAtIndex(0);
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

    /// @notice Processes the Bitcoin sweep transaction input vector. It
    ///         extracts each input and tries to obtain associated deposit or
    ///         main UTXO data, depending on the input type. Reverts
    ///         if one of the inputs cannot be recognized as a pointer to a
    ///         revealed deposit or expected main UTXO.
    ///         This function also marks each processed deposit as swept.
    /// @param sweepTxInputVector Bitcoin sweep transaction input vector.
    ///        This function assumes vector's structure is valid so it must be
    ///        validated using e.g. `BTCUtils.validateVin` function before
    ///        it is passed here
    /// @param mainUtxo Data of the wallet's main UTXO. If no main UTXO
    ///        exists for the given the wallet, this parameter's fields should
    ///        be zeroed to bypass the main UTXO validation
    /// @return inputsTotalValue Sum of all inputs values i.e. all deposits and
    ///         main UTXO value, if present.
    /// @return depositors Addresses of depositors who performed processed
    ///         deposits. Ordered in the same order as deposits inputs in the
    ///         input vector. Size of this array is either equal to the
    ///         number of inputs (main UTXO doesn't exist) or less by one
    ///         (main UTXO exists and is pointed by one of the inputs).
    /// @return depositedAmounts Amounts of deposits corresponding to processed
    ///         deposits. Ordered in the same order as deposits inputs in the
    ///         input vector. Size of this array is either equal to the
    ///         number of inputs (main UTXO doesn't exist) or less by one
    ///         (main UTXO exists and is pointed by one of the inputs).
    function processSweepTxInputs(
        bytes memory sweepTxInputVector,
        BitcoinTx.UTXO memory mainUtxo
    )
        internal
        returns (
            uint256 inputsTotalValue,
            address[] memory depositors,
            uint256[] memory depositedAmounts
        )
    {
        // If the passed `mainUtxo` parameter's values are zeroed, the main UTXO
        // for the given wallet doesn't exist and it is not expected to be
        // included in the sweep transaction input vector.
        bool mainUtxoExpected = mainUtxo.txHash != bytes32(0);
        bool mainUtxoFound = false;

        // Determining the total number of sweep transaction inputs in the same
        // way as for number of outputs. See `BitcoinTx.inputVector` docs for
        // more details.
        (uint256 inputsCompactSizeUintLength, uint256 inputsCount) =
            sweepTxInputVector.parseVarInt();

        // To determine the first input starting index, we must jump over
        // the compactSize uint which prepends the input vector. One byte
        // must be added because `BtcUtils.parseVarInt` does not include
        // compactSize uint tag in the returned length.
        //
        // For >= 0 && <= 252, `BTCUtils.determineVarIntDataLengthAt`
        // returns `0`, so we jump over one byte of compactSize uint.
        //
        // For >= 253 && <= 0xffff there is `0xfd` tag,
        // `BTCUtils.determineVarIntDataLengthAt` returns `2` (no
        // tag byte included) so we need to jump over 1+2 bytes of
        // compactSize uint.
        //
        // Please refer `BTCUtils` library and compactSize uint
        // docs in `BitcoinTx` library for more details.
        uint256 inputStartingIndex = 1 + inputsCompactSizeUintLength;

        // Determine the swept deposits count. If main UTXO is NOT expected,
        // all inputs should be deposits. If main UTXO is expected, one input
        // should point to that main UTXO.
        depositors = new address[](
            !mainUtxoExpected ? inputsCount : inputsCount - 1
        );
        depositedAmounts = new uint256[](depositors.length);

        // Initialize helper variables.
        uint256 processedDepositsCount = 0;

        // Inputs processing loop.
        for (uint256 i = 0; i < inputsCount; i++) {
            // Check if we are at the end of the input vector.
            if (inputStartingIndex >= sweepTxInputVector.length) {
                break;
            }

            (bytes32 inputTxHash, uint32 inputTxIndex, uint256 inputLength) =
                parseTxInputAt(sweepTxInputVector, inputStartingIndex);

            DepositRequest storage deposit =
                deposits[
                    uint256(
                        keccak256(abi.encodePacked(inputTxHash, inputTxIndex))
                    )
                ];

            if (deposit.revealedAt != 0) {
                // If we entered here, that means the input was identified as
                // a revealed deposit.
                require(deposit.sweptAt == 0, "Deposit already swept");

                if (processedDepositsCount == depositors.length) {
                    // If this condition is true, that means a deposit input
                    // took place of an expected main UTXO input.
                    // In other words, there is no expected main UTXO
                    // input and all inputs come from valid, revealed deposits.
                    revert(
                        "Expected main UTXO not present in sweep transaction inputs"
                    );
                }

                /* solhint-disable-next-line not-rely-on-time */
                deposit.sweptAt = uint32(block.timestamp);

                depositors[processedDepositsCount] = deposit.depositor;
                depositedAmounts[processedDepositsCount] = deposit.amount;
                inputsTotalValue += depositedAmounts[processedDepositsCount];

                processedDepositsCount++;
            } else if (
                mainUtxoExpected != mainUtxoFound &&
                mainUtxo.txHash == inputTxHash
            ) {
                // If we entered here, that means the input was identified as
                // the expected main UTXO.
                inputsTotalValue += mainUtxo.txOutputValue;
                mainUtxoFound = true;
            } else {
                revert("Unknown input type");
            }

            // Make the `inputStartingIndex` pointing to the next input by
            // increasing it by current input's length.
            inputStartingIndex += inputLength;
        }

        // Construction of the input processing loop guarantees that:
        // `processedDepositsCount == depositors.length == depositedAmounts.length`
        // is always true at this point. We just use the first variable
        // to assert the total count of swept deposit is bigger than zero.
        require(
            processedDepositsCount > 0,
            "Sweep transaction must process at least one deposit"
        );

        // Assert the main UTXO was used as one of current sweep's inputs if
        // it was actually expected.
        require(
            mainUtxoExpected == mainUtxoFound,
            "Expected main UTXO not present in sweep transaction inputs"
        );

        return (inputsTotalValue, depositors, depositedAmounts);
    }

    /// @notice Parses a Bitcoin transaction input starting at the given index.
    /// @param inputVector Bitcoin transaction input vector
    /// @param inputStartingIndex Index the given input starts at
    /// @return inputTxHash 32-byte hash of the Bitcoin transaction which is
    ///         pointed in the given input's outpoint.
    /// @return inputTxIndex 4-byte index of the Bitcoin transaction output
    ///         which is pointed in the given input's outpoint.
    /// @return inputLength Byte length of the given input.
    /// @dev This function assumes vector's structure is valid so it must be
    ///      validated using e.g. `BTCUtils.validateVin` function before it
    ///      is passed here.
    function parseTxInputAt(
        bytes memory inputVector,
        uint256 inputStartingIndex
    )
        internal
        pure
        returns (
            bytes32 inputTxHash,
            uint32 inputTxIndex,
            uint256 inputLength
        )
    {
        inputTxHash = inputVector.extractInputTxIdLeAt(inputStartingIndex);

        inputTxIndex = BTCUtils.reverseUint32(
            uint32(inputVector.extractTxIndexLeAt(inputStartingIndex))
        );

        inputLength = inputVector.determineInputLengthAt(inputStartingIndex);

        return (inputTxHash, inputTxIndex, inputLength);
    }

    /// @notice Requests redemption of the given amount from the specified
    ///         wallet to the redeemer Bitcoin output script hash.
    /// @param walletPubKeyHash The 20-byte wallet public key hash (computed
    ///        using HASH160 opcode)
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain
    /// @param redeemerOutputHash The 20-byte (P2PKH, P2WPKH, or P2SH) or
    ///        32-byte (P2WSH) output hash that will be used to lock
    ///        redeemed BTC
    /// @param amount Requested amount in satoshi. This is also the TBTC amount
    ///        that is taken from redeemer's balance in the Bank upon request.
    ///        Once the request is handled, the actual amount of BTC locked
    ///        on the redeemer output hash will be always lower than this value
    ///        since the treasury and Bitcoin transaction fees must be incurred.
    ///        The minimal amount satisfying the request can be computed as:
    ///        `amount - redemptionTreasuryFee - redemptionTxMaxFee`.
    ///        Fees values are taken at the moment of request creation.
    /// @dev Requirements:
    ///      - Wallet behind `walletPubKeyHash` must be active
    ///      - `mainUtxo` components must point to the recent main UTXO
    ///        of the given wallet, as currently known on the Ethereum chain.
    ///      - `redeemerOutputHash` must be proper 20-byte or 32-byte BTC hash
    ///      - `redeemerOutputHash` cannot be the same as `walletPubKeyHash`
    ///      - `amount` must be above or equal the `redemptionDustThreshold`
    ///      - Given `walletPubKeyHash` and `redeemerOutputHash` pair can be
    ///        used for only one pending request at the same time
    ///      - Wallet must have enough Bitcoin balance to proceed the request
    ///      - Redeemer must make an allowance in the Bank that the Bridge
    ///        contract can spend the given `amount`.
    function requestRedemption(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes calldata redeemerOutputHash,
        uint64 amount
    ) external {
        require(
            wallets[walletPubKeyHash].state == WalletState.Active,
            "Wallet must be active"
        );

        bytes32 mainUtxoHash = mainUtxos[walletPubKeyHash];
        require(mainUtxoHash != bytes32(0), "No main UTXO for given wallet");
        require(
            keccak256(
                abi.encodePacked(
                    mainUtxo.txHash,
                    mainUtxo.txOutputIndex,
                    mainUtxo.txOutputValue
                )
            ) == mainUtxoHash,
            "Invalid main UTXO data"
        );

        // TODO: Check if `walletPubKeyHash` should be validated in some other ways.

        // Validate if redeemer output hash has a correct length corresponding
        // to a valid Bitcoin hash. P2PKH, P2WPKH and P2SH outputs will
        // have 20-byte hashes. P2WSH outputs will have 32-byte hash.
        require(
            redeemerOutputHash.length == 20 || redeemerOutputHash.length == 32,
            "Incorrect redeemer output hash length"
        );

        require(
            keccak256(abi.encodePacked(walletPubKeyHash)) !=
                keccak256(redeemerOutputHash),
            "Redeemer output hash must not be equal to the wallet PKH"
        );

        require(
            amount >= redemptionDustThreshold,
            "Redemption amount too small"
        );

        // The redemption key is built on top of wallet public key hash
        // and redeemer output hash pair. That means there can be only one
        // request asking for redemption from specific wallet to the given
        // BTC hash in the same time.
        uint256 redemptionKey =
            uint256(
                keccak256(
                    abi.encodePacked(walletPubKeyHash, redeemerOutputHash)
                )
            );

        require(
            // slither-disable-next-line incorrect-equality
            pendingRedemptionRequests[redemptionKey].requestedAt == 0,
            "Pending request with same redemption key already exists"
        );

        uint64 treasuryFee = redemptionTreasuryFee;
        uint64 txMaxFee = redemptionTxMaxFee;

        // The wallet's BTC balance should allow to cover the actual BTC amount
        // transferred to the redeemer along with its share of the transaction
        // fee. Those two components always sum up to the request's maximum
        // redeemable amount which is computed as the difference between the
        // requested amount and the treasury fee. This is why one should
        // add the redeemable amount to the total requested value for the given
        // wallet and assert this total value doesn't exceed the current main
        // UTXO value  which is actually the same as the current wallet balance.
        wallets[walletPubKeyHash].pendingRedemptionsValue +=
            amount -
            treasuryFee;
        require(
            mainUtxo.txOutputValue >=
                wallets[walletPubKeyHash].pendingRedemptionsValue,
            "Insufficient wallet funds"
        );

        pendingRedemptionRequests[redemptionKey] = RedemptionRequest(
            msg.sender,
            amount,
            treasuryFee,
            txMaxFee,
            /* solhint-disable-next-line not-rely-on-time */
            uint32(block.timestamp)
        );

        emit RedemptionRequested(
            walletPubKeyHash,
            redeemerOutputHash,
            msg.sender,
            amount,
            treasuryFee,
            txMaxFee
        );

        bank.transferBalanceFrom(msg.sender, address(this), amount);
    }

    /// @notice Used by the wallet to prove the BTC redemption transaction
    ///         and to make the necessary bookkeeping. Redemption is only
    ///         accepted if it satisfies SPV proof.
    ///
    ///         The function is performing Bank balance updates by burning
    ///         the total redeemed amount from Bridge balance and transferring
    ///         the treasury fee sum to the treasury address.
    ///
    ///         It is possible to prove the given redemption only one time.
    /// @param redemptionTx Bitcoin redemption transaction data
    /// @param redemptionProof Bitcoin redemption proof data
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain.
    /// @param walletPubKeyHash 20-byte public key hash (computed using
    ///        HASH160 opcode) of the wallet which performed the redemption
    ///        transaction.
    /// @dev Requirements:
    ///      - `redemptionTx` components must match the expected structure. See
    ///        `BitcoinTx.Info` docs for reference. Their values must exactly
    ///        correspond to appropriate Bitcoin transaction fields to produce
    ///        a provable transaction hash.
    ///      - The `redemptionTx` should represent a Bitcoin transaction with
    ///        exactly 1 input that refers to the wallet's main UTXO. That
    ///        transaction should have 1..n outputs handling existing pending
    ///        redemption requests or pointing to reported redemption faults.
    ///        There can be also 1 optional output representing the
    ///        change and pointing back to the 20-byt wallet public key hash.
    ///        The change should be always present if the redeemed value sum
    ///        is lower than the total wallet's BTC balance.
    ///      - `redemptionProof` components must match the expected structure.
    ///        See `BitcoinTx.Proof` docs for reference. The `bitcoinHeaders`
    ///        field must contain a valid number of block headers, not less
    ///        than the `txProofDifficultyFactor` contract constant.
    ///      - `mainUtxo` components must point to the recent main UTXO
    ///        of the given wallet, as currently known on the Ethereum chain.
    ///        Additionally, the recent main UTXO on Ethereum must be set.
    ///      - `walletPubKeyHash` must be connected with the main UTXO used
    ///        as transaction single input.
    function submitRedemptionProof(
        BitcoinTx.Info calldata redemptionTx,
        BitcoinTx.Proof calldata redemptionProof,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes20 walletPubKeyHash
    ) external {
        // TODO: Just as for `submitSweepProof`, fail early if the function
        //       call gets frontrunned. See discussion:
        //       https://github.com/keep-network/tbtc-v2/pull/106#discussion_r801745204

        // The actual transaction proof is performed here. After that point, we
        // can assume the transaction happened on Bitcoin chain and has
        // a sufficient number of confirmations as determined by
        // `txProofDifficultyFactor` constant.
        bytes32 redemptionTxHash =
            validateBitcoinTxProof(redemptionTx, redemptionProof);

        // Perform validation of the redemption transaction input. Specifically,
        // check if it refers to the expected wallet's main UTXO.
        validateRedemptionTxInput(
            redemptionTx.inputVector,
            mainUtxo,
            walletPubKeyHash
        );

        // Process redemption transaction outputs to extract some info required
        // for further processing.
        RedemptionTxOutputsInfo memory outputsInfo =
            processRedemptionTxOutputs(
                redemptionTx.outputVector,
                walletPubKeyHash
            );

        if (outputsInfo.changeValue > 0) {
            // If the change value is grater than zero, it means the change
            // output exists and can be used as new wallet's main UTXO.
            mainUtxos[walletPubKeyHash] = keccak256(
                abi.encodePacked(
                    redemptionTxHash,
                    outputsInfo.changeIndex,
                    outputsInfo.changeValue
                )
            );
        } else {
            // If the change value is zero, it means the change output doesn't
            // exists and no funds left on the wallet. Delete the main UTXO
            // for that wallet to represent that state in a proper way.
            delete mainUtxos[walletPubKeyHash];
        }

        wallets[walletPubKeyHash].pendingRedemptionsValue -= outputsInfo
            .totalBurnableValue;

        emit RedemptionsPerformed(walletPubKeyHash, redemptionTxHash);

        bank.decreaseBalance(outputsInfo.totalBurnableValue);
        bank.transferBalance(treasury, outputsInfo.totalTreasuryFee);
    }

    /// @notice Validates whether the redemption Bitcoin transaction input
    ///         vector contains a single input referring to the wallet's main
    ///         UTXO. Reverts in case the validation fail.
    /// @param redemptionTxInputVector Bitcoin redemption transaction input
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVin` function
    ///        before it is passed here
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain.
    /// @param walletPubKeyHash 20-byte public key hash (computed using
    ///        HASH160 opcode) of the wallet which performed the redemption
    ///        transaction.
    function validateRedemptionTxInput(
        bytes memory redemptionTxInputVector,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes20 walletPubKeyHash
    ) internal {
        // Assert that main UTXO for passed wallet exists in storage.
        bytes32 mainUtxoHash = mainUtxos[walletPubKeyHash];
        require(mainUtxoHash != bytes32(0), "No main UTXO for given wallet");

        // Assert that passed main UTXO parameter is the same as in storage and
        // can be used for further processing.
        require(
            keccak256(
                abi.encodePacked(
                    mainUtxo.txHash,
                    mainUtxo.txOutputIndex,
                    mainUtxo.txOutputValue
                )
            ) == mainUtxoHash,
            "Invalid main UTXO data"
        );

        // Assert that the single redemption transaction input actually
        // refers to the wallet's main UTXO.
        (bytes32 redemptionTxInputTxHash, uint32 redemptionTxInputTxIndex) =
            processRedemptionTxInput(redemptionTxInputVector);
        require(
            mainUtxo.txHash == redemptionTxInputTxHash &&
                mainUtxo.txOutputIndex == redemptionTxInputTxIndex,
            "Redemption transaction input must point to the wallet's main UTXO"
        );
    }

    /// @notice Processes the Bitcoin redemption transaction input vector. It
    ///         extracts the single input then the transaction hash and output
    ///         index from its outpoint.
    /// @param redemptionTxInputVector Bitcoin redemption transaction input
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVin` function
    ///        before it is passed here
    /// @return inputTxHash 32-byte hash of the Bitcoin transaction which is
    ///         pointed in the input's outpoint.
    /// @return inputTxIndex 4-byte index of the Bitcoin transaction output
    ///         which is pointed in the input's outpoint.
    function processRedemptionTxInput(bytes memory redemptionTxInputVector)
        internal
        pure
        returns (bytes32 inputTxHash, uint32 inputTxIndex)
    {
        // To determine the total number of redemption transaction inputs,
        // we need to parse the compactSize uint (VarInt) the input vector is
        // prepended by. That compactSize uint encodes the number of vector
        // elements using the format presented in:
        // https://developer.bitcoin.org/reference/transactions.html#compactsize-unsigned-integers
        // We don't need asserting the compactSize uint is parseable since it
        // was already checked during `validateVin` validation.
        // See `BitcoinTx.inputVector` docs for more details.
        (, uint256 inputsCount) = redemptionTxInputVector.parseVarInt();
        require(
            inputsCount == 1,
            "Redemption transaction must have a single input"
        );

        bytes memory input = redemptionTxInputVector.extractInputAtIndex(0);

        inputTxHash = input.extractInputTxIdLE();

        inputTxIndex = BTCUtils.reverseUint32(uint32(input.extractTxIndexLE()));

        return (inputTxHash, inputTxIndex);
    }

    /// @notice Processes the Bitcoin redemption transaction output vector.
    ///         It extracts each output and tries to identify it as a pending
    ///         redemption request, reported invalid redemption, or change.
    ///         Reverts if one of the outputs cannot be recognized properly.
    ///         This function also marks each request as processed by removing
    ///         them from `pendingRedemptionRequests` mapping.
    /// @param redemptionTxOutputVector Bitcoin redemption transaction output
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVout` function
    ///        before it is passed here
    /// @param walletPubKeyHash 20-byte public key hash (computed using
    ///        HASH160 opcode) of the wallet which performed the redemption
    ///        transaction.
    /// @return info Outcomes of the processing.
    function processRedemptionTxOutputs(
        bytes memory redemptionTxOutputVector,
        bytes20 walletPubKeyHash
    ) internal returns (RedemptionTxOutputsInfo memory info) {
        // Determining the total number of redemption transaction outputs in
        // the same way as for number of inputs. See `BitcoinTx.outputVector`
        // docs for more details.
        (uint256 outputsCompactSizeUintLength, uint256 outputsCount) =
            redemptionTxOutputVector.parseVarInt();

        // To determine the first output starting index, we must jump over
        // the compactSize uint which prepends the output vector. One byte
        // must be added because `BtcUtils.parseVarInt` does not include
        // compactSize uint tag in the returned length.
        //
        // For >= 0 && <= 252, `BTCUtils.determineVarIntDataLengthAt`
        // returns `0`, so we jump over one byte of compactSize uint.
        //
        // For >= 253 && <= 0xffff there is `0xfd` tag,
        // `BTCUtils.determineVarIntDataLengthAt` returns `2` (no
        // tag byte included) so we need to jump over 1+2 bytes of
        // compactSize uint.
        //
        // Please refer `BTCUtils` library and compactSize uint
        // docs in `BitcoinTx` library for more details.
        uint256 outputStartingIndex = 1 + outputsCompactSizeUintLength;

        // Calculate the keccak256 from `walletPubKeyHash` upfront to avoid
        // computing it multiple times within the processing loop and save
        // on gas costs in result.
        bytes32 walletPubKeyHashKeccak =
            keccak256(abi.encodePacked(walletPubKeyHash));

        // Outputs processing loop.
        for (uint256 i = 0; i < outputsCount; i++) {
            // Check if we are at the end of the output vector.
            if (outputStartingIndex >= redemptionTxOutputVector.length) {
                break;
            }

            // TODO: Check if we can optimize gas costs by adding
            //       `extractValueAt` and `extractHashAt` in `bitcoin-spv-sol`
            //       in order to avoid allocating bytes in memory.
            uint256 outputLength =
                redemptionTxOutputVector.determineOutputLengthAt(
                    outputStartingIndex
                );
            bytes memory output =
                redemptionTxOutputVector.slice(
                    outputStartingIndex,
                    outputLength
                );

            // Extract the value and hash from given output.
            uint64 outputValue = output.extractValue();
            bytes memory outputHash = output.extractHash();

            if (
                info.changeValue == 0 &&
                keccak256(outputHash) == walletPubKeyHashKeccak &&
                outputValue > 0
            ) {
                // If we entered here, that means the change output with a
                // proper non-zero value was found.
                info.changeIndex = uint32(i);
                info.changeValue = outputValue;
            } else {
                // If we entered here, that the means the given output is
                // supposed to represent a redemption. Build the redemption key
                // to perform that check.
                uint256 redemptionKey =
                    uint256(
                        keccak256(
                            abi.encodePacked(walletPubKeyHash, outputHash)
                        )
                    );

                if (
                    pendingRedemptionRequests[redemptionKey].requestedAt !=
                    uint32(0)
                ) {
                    // If we entered here, that means the output was identified
                    // as a pending redemption request.
                    RedemptionRequest storage request =
                        pendingRedemptionRequests[redemptionKey];
                    // Compute the request's redeemable amount as the requested
                    // amount reduced by the treasury fee. The request's
                    // minimal amount is then the redeemable amount reduced by
                    // the maximum transaction fee.
                    uint64 redeemableAmount =
                        request.requestedAmount - request.treasuryFee;
                    // Output value must fit between the request's redeemable
                    // and minimal amounts to be deemed valid.
                    require(
                        redeemableAmount >= outputValue &&
                            outputValue >= redeemableAmount - request.txMaxFee,
                        "Output value is not acceptable for redemption request"
                    );
                    // Add the redeemable amount to the total burnable value
                    // the Bridge will use to decrease its balance in the Bank.
                    info.totalBurnableValue += redeemableAmount;
                    // Add the request's treasury fee to the total treasury fee
                    // value the Bridge will transfer to the treasury.
                    info.totalTreasuryFee += request.treasuryFee;
                    // Request was properly handled so remove its redemption
                    // key from the mapping to make it reusable for further
                    // requests.
                    delete pendingRedemptionRequests[redemptionKey];
                } else {
                    // If we entered here, the output is not a redemption
                    // request but there is still a chance the given output is
                    // related to a reported redemption fault. If so, ignore it
                    // as the wallet was already punished for causing the fault
                    // and allow processing other potentially correct
                    // outputs. If not, revert because the output
                    // cannot be recognized properly.
                    require(
                        redemptionFaults[redemptionKey],
                        "Unknown output type"
                    );
                }
            }

            // Make the `outputStartingIndex` pointing to the next output by
            // increasing it by current output's length.
            outputStartingIndex += outputLength;
        }

        if (outputsCount == 1 && info.changeValue > 0) {
            // This is an edge case when there is a single output and that
            // output refers back to the wallet PKH. Such a transaction just
            // burns fees thus should be considered fraudulent and their proof
            // should be rejected. However, if that transaction was already
            // reported as fraud and wallet was punished, let it pass to update
            // the main UTXO and allow the wallet redeem their faults by
            // transferring their outstanding funds to another healthy wallet.
            // Note the redemption key in that case is:
            // keccak256(walletPubKeyHash | walletPubKeyHash) since the
            // `walletPubKeyHash` takes place of the usual `redeemerOutputHash`.
            require(
                redemptionFaults[
                    uint256(
                        keccak256(
                            abi.encodePacked(walletPubKeyHash, walletPubKeyHash)
                        )
                    )
                ],
                "Redemption transaction contains single change output"
            );
        }

        return info;
    }

    // TODO: Function `notifyRedemptionTimeout. That function must:
    //       1. Take a the `walletPubKey` and `redeemerOutputHash` as params.
    //       2. Build the redemption key using those params.
    //       3. Use the redemption key and take the request from
    //          `pendingRedemptionRequests` mapping.
    //       4. If request doesn't exist in mapping - revert.
    //       5. If request exits, and is timed out - remove the redemption key
    //          from `pendingRedemptionRequests` and put it to `redemptionFaults`.
    //          No need to check if `redemptionFaults` mapping already contains
    //          that key because `requestRedemption` blocks requests targeting
    //          faulty wallets so there is no possibility that the given
    //          redemption key could be reported as timed out multiple times.
    //          On the other hand, if given redemption key was already
    //          marked as faulty due to an amount-related fraud, it will not
    //          be possible to report a time out on it since it won't be
    //          present in `pendingRedemptionRequests` mapping.
    //       6. Return the `requestedAmount` to the `redeemer`.
    //       7. Reduce the `pendingRedemptionsValue` (`wallets` mapping) for
    //          given wallet by request's redeemable amount computed as
    //          `requestedAmount - treasuryFee`.
    //       8. Punish the wallet, probably by slashing its operators.
    //       9. Change wallet's state in `wallets` mapping to `MovingFunds` in
    //          order to prevent against new redemption requests hitting
    //          that wallet.
    //      10. Expect the wallet to transfer its funds to another healthy
    //          wallet (just as in case of failed heartbeat).

    // TODO: Function `submitRedemptionFraudProof`. That function must:
    //       1. Take a `BitcoinTx.Info` and `BitcoinTx.Proof` of the
    //          fraudulent transaction. It should also accept `walletPubKeyHash`.
    //       2. Perform SPV proof to make sure it occurred on Bitcoin chain.
    //          If not - revert.
    //       3. Check if transaction hash is present in `fraudulentTransactions`
    //          mapping. If present - revert.
    //       4. Validate the input vector contains the main UTXO (fraudulent
    //          transaction can use multiple inputs deliberately) for given
    //          `walletPubKeyHash`. If invalid - revert. An open question is
    //          what to do if transaction has proper outputs but wrong number
    //          of inputs and it can't be processed by `submitRedemptionProof`.
    //       5. Process outputs. Multiple paths are possible:
    //          - If there are outputs corresponding to proper redemption
    //            requests - ignore them
    //          - If there are outputs corresponding to existing requests
    //            but output amounts are wrong - remove their redemption key from
    //            `pendingRedemptionRequests` and put it to `redemptionFaults`
    //            mapping. Reimburse the `redeemer` of each underfunded request
    //            by covering the difference to at least the request's
    //            `minimalAmount` in TBTC. Reduce the `pendingRedemptionsValue`
    //            (`wallets` mapping) for given wallet accordingly.
    //          - If there are outputs not corresponding to any request - put
    //            them to the `redemptionFaults` mapping.
    //          - If the given output is a change it should be treated
    //            differently, depending on how other outputs looks like.
    //            All transactions transferring funds back to wallet PKH
    //            without doing anything else, burns the main UTXO for fees.
    //            Wallet should be punished for that and the main UTXO key
    //            should be put to `redemptionFaults` as usual.
    //          - If there are outputs with zero value - put them to the
    //            `redemptionFaults` mapping. It doesn't matter if they
    //            are provably unspendable zero-value false return (OP_RETURN)
    //            or non-false return outputs, they can be used to burn main
    //            UTXO value via fees so transaction that uses them should be
    //            considered fraudulent.
    //
    //          There is no need to revert if given redemption key is already
    //          in `redemptionFaults` mapping. However, one must count the
    //          number of unique non-overwriting inserts under `faultsCount`.
    //          This is because there are some edge cases here:
    //          - A redemption key looking as fraudulent due to being non-expected,
    //            can be already present in `redemptionFaults` due to being a
    //            timeout. Normally we should not deem it as a new fault and
    //            count it to `redemptionFaults` in order to avoid punishing the
    //            wallet twice for the same timeout. In the same time, it
    //            can be an actual fraud leveraging the fact the given redemption
    //            key was already punished for timeout. To detect such a case
    //            we can store the timed out request amount as `redemptionFaults`
    //            mapping value, and punish for fraud in case the transferred
    //            value exceed the redeemable amount from the timed out request.
    //          - A fraudulent transaction can deliberately use multiple
    //            outputs with same script hash. This will produce the same
    //            redemption key which must be put to `redemptionFaults`
    //            multiple times so it should not cause a revert and it is
    //            enough to count it once in `redemptionFaults`.
    //       6. If `faultsCount > 0` transaction is fraudulent. If not - revert.
    //       7. Punish the wallet, probably by slashing its operators.
    //       8. Change wallet's state in `wallets` mapping to `MovingFunds` in
    //          order to prevent against new redemption requests hitting
    //          that wallet.
    //       9. Expect the wallet to transfer its funds to another healthy
    //          wallet (just as in case of failed heartbeat).
    //      10. Put the transaction hash to `fraudulentTransactions` mapping to
    //          prevent against replays.
}
