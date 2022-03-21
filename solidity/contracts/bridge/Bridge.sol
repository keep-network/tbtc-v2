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

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";
import {IWalletOwner as EcdsaWalletOwner} from "@keep-network/ecdsa/contracts/api/IWalletOwner.sol";

import "../bank/Bank.sol";
import "./BitcoinTx.sol";
import "./EcdsaLib.sol";
import "./Wallets.sol";

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
contract Bridge is Ownable, EcdsaWalletOwner {
    using BTCUtils for bytes;
    using BTCUtils for uint256;
    using BytesLib for bytes;
    using Wallets for Wallets.Data;

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
        // Treasury TBTC fee in satoshi at the moment of deposit reveal.
        uint64 treasuryFee;
        // UNIX timestamp the deposit was swept at. Note this is not the
        // time when the deposit was swept on the Bitcoin chain but actually
        // the time when the sweep proof was delivered to the Ethereum chain.
        uint32 sweptAt;
    }

    /// @notice Represents an outcome of the sweep Bitcoin transaction
    ///         inputs processing.
    struct SweepTxInputsInfo {
        // Sum of all inputs values i.e. all deposits and main UTXO value,
        // if present.
        uint256 inputsTotalValue;
        // Addresses of depositors who performed processed deposits. Ordered in
        // the same order as deposits inputs in the input vector. Size of this
        // array is either equal to the number of inputs (main UTXO doesn't
        // exist) or less by one (main UTXO exists and is pointed by one of
        // the inputs).
        address[] depositors;
        // Amounts of deposits corresponding to processed deposits. Ordered in
        // the same order as deposits inputs in the input vector. Size of this
        // array is either equal to the number of inputs (main UTXO doesn't
        // exist) or less by one (main UTXO exists and is pointed by one of
        // the inputs).
        uint256[] depositedAmounts;
        // Values of the treasury fee corresponding to processed deposits.
        // Ordered in the same order as deposits inputs in the input vector.
        // Size of this array is either equal to the number of inputs (main
        // UTXO doesn't exist) or less by one (main UTXO exists and is pointed
        // by one of the inputs).
        uint256[] treasuryFees;
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
        // It includes the total amount of all BTC redeemed in the transaction
        // and the fee paid to BTC miners for the redemption transaction.
        uint64 totalBurnableValue;
        // Total TBTC value in satoshi that should be transferred to
        // the treasury. It is a sum of all treasury fees paid by all
        // redeemers included in the redemption transaction.
        uint64 totalTreasuryFee;
        // Index of the change output. The change output becomes
        // the new main wallet's UTXO.
        uint32 changeIndex;
        // Value in satoshi of the change output.
        uint64 changeValue;
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
    ///         Treasury takes part in the operators rewarding process.
    address public immutable treasury;

    /// TODO: Make it governable.
    /// @notice The minimal amount that can be requested for deposit.
    ///         Value of this parameter must take into account the value of
    ///         `depositTreasuryFeeDivisor` and `depositTxMaxFee`
    ///         parameters in order to make requests that can incur the
    ///         treasury and transaction fee and still satisfy the depositor.
    uint64 public depositDustThreshold;

    /// TODO: Make it governable.
    /// @notice Divisor used to compute the treasury fee taken from each
    ///         deposit and transferred to the treasury upon sweep proof
    ///         submission. That fee is computed as follows:
    ///         `treasuryFee = depositedAmount / depositTreasuryFeeDivisor`
    ///         For example, if the treasury fee needs to be 2% of each deposit,
    ///         the `depositTreasuryFeeDivisor` should be set to `50`
    ///         because `1/50 = 0.02 = 2%`.
    uint64 public depositTreasuryFeeDivisor;

    /// TODO: Make it governable.
    /// @notice Maximum amount of BTC transaction fee that can be incurred by
    ///         each swept deposit being part of the given sweep
    ///         transaction. If the maximum BTC transaction fee is exceeded,
    ///         such transaction is considered a fraud.
    uint64 public depositTxMaxFee;

    /// TODO: Make it governable.
    /// @notice The minimal amount that can be requested for redemption.
    ///         Value of this parameter must take into account the value of
    ///         `redemptionTreasuryFeeDivisor` and `redemptionTxMaxFee`
    ///         parameters in order to make requests that can incur the
    ///         treasury and transaction fee and still satisfy the redeemer.
    uint64 public redemptionDustThreshold;

    /// TODO: Make it governable.
    /// @notice Divisor used to compute the treasury fee taken from each
    ///         redemption request and transferred to the treasury upon
    ///         successful request finalization. That fee is computed as follows:
    ///         `treasuryFee = requestedAmount / redemptionTreasuryFeeDivisor`
    ///         For example, if the treasury fee needs to be 2% of each
    ///         redemption request, the `redemptionTreasuryFeeDivisor` should
    ///         be set to `50` because `1/50 = 0.02 = 2%`.
    uint64 public redemptionTreasuryFeeDivisor;

    /// TODO: Make it governable.
    /// @notice Maximum amount of BTC transaction fee that can be incurred by
    ///         each redemption request being part of the given redemption
    ///         transaction. If the maximum BTC transaction fee is exceeded, such
    ///         transaction is considered a fraud.
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
    ///         The fundingTxHash is bytes32 (ordered as in Bitcoin internally)
    ///         and fundingOutputIndex an uint32. This mapping may contain valid
    ///         and invalid deposits and the wallet is responsible for
    ///         validating them before attempting to execute a sweep.
    mapping(uint256 => DepositRequest) public deposits;

    /// @notice Collection of all pending redemption requests indexed by
    ///         redemption key built as
    ///         keccak256(walletPubKeyHash | redeemerOutputScript). The
    ///         walletPubKeyHash is the 20-byte wallet's public key hash
    ///         (computed using Bitcoin HASH160 over the compressed ECDSA
    ///         public key) and redeemerOutputScript is a Bitcoin script
    ///         (P2PKH, P2WPKH, P2SH or P2WSH) that will be used to lock
    ///         redeemed BTC as requested by the redeemer. Requests are added
    ///         to this mapping by the `requestRedemption` method (duplicates
    ///         not allowed) and are removed by one of the following methods:
    ///         - `submitRedemptionProof` in case the request was handled
    ///           successfully
    ///         - `notifyRedemptionTimeout` in case the request was reported
    ///           to be timed out
    ///         - `submitRedemptionFraudProof` in case the request was handled
    ///           in an fraudulent way amount-wise.
    mapping(uint256 => RedemptionRequest) public pendingRedemptions;

    /// @notice Collection of all timed out redemptions requests indexed by
    ///         redemption key built as
    ///         keccak256(walletPubKeyHash | redeemerOutputScript). The
    ///         walletPubKeyHash is the 20-byte wallet's public key hash
    ///         (computed using Bitcoin HASH160 over the compressed ECDSA
    ///         public key) and redeemerOutputScript is the Bitcoin script
    ///         (P2PKH, P2WPKH, P2SH or P2WSH) that is involved in the timed
    ///         out request. Timed out requests are stored in this mapping to
    ///         avoid slashing the wallets multiple times for the same timeout.
    ///         Only one method can add to this mapping:
    ///         - `notifyRedemptionTimeout` which puts the redemption key
    ///           to this mapping basing on a timed out request stored
    ///           previously in `pendingRedemptions` mapping.
    ///
    // TODO: Remove that Slither disable once this variable is used.
    // slither-disable-next-line uninitialized-state
    mapping(uint256 => RedemptionRequest) public timedOutRedemptions;

    /// @notice State related with wallets.
    Wallets.Data internal wallets;

    event NewWalletRequested();

    event NewWalletRegistered(
        bytes32 indexed ecdsaWalletID,
        bytes20 indexed walletPubKeyHash
    );

    event WalletMovingFunds(
        bytes32 indexed ecdsaWalletID,
        bytes20 indexed walletPubKeyHash
    );

    event WalletClosed(
        bytes32 indexed ecdsaWalletID,
        bytes20 indexed walletPubKeyHash
    );

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
        bytes redeemerOutputScript,
        address redeemer,
        uint64 requestedAmount,
        uint64 treasuryFee,
        uint64 txMaxFee
    );

    event RedemptionsCompleted(
        bytes20 walletPubKeyHash,
        bytes32 redemptionTxHash
    );

    constructor(
        address _bank,
        address _relay,
        address _treasury,
        address _ecdsaWalletRegistry,
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
        depositDustThreshold = 1000000; // 1000000 satoshi = 0.01 BTC
        depositTxMaxFee = 1000; // 1000 satoshi
        depositTreasuryFeeDivisor = 2000; // 1/2000 == 5bps == 0.05% == 0.0005
        redemptionDustThreshold = 1000000; // 1000000 satoshi = 0.01 BTC
        redemptionTreasuryFeeDivisor = 2000; // 1/2000 == 5bps == 0.05% == 0.0005
        redemptionTxMaxFee = 1000; // 1000 satoshi
        redemptionTimeout = 172800; // 48 hours

        // TODO: Revisit initial values.
        wallets.init(_ecdsaWalletRegistry);
        wallets.setCreationPeriod(1 weeks);
        wallets.setBtcBalanceRange(1 * 1e8, 10 * 1e8); // 1 BTC - 10 BTC
    }

    // TODO: Add function `onNewWalletCreated` according to discussion:
    //       https://github.com/keep-network/tbtc-v2/pull/128#discussion_r809885230

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

    /// @notice Requests creation of a new wallet. This function just
    ///         forms a request and the creation process is performed
    ///         asynchronously. Once a wallet is created, the ECDSA Wallet
    ///         Registry will notify this contract by calling the
    ///         `__ecdsaWalletCreatedCallback` function.
    /// @param activeWalletMainUtxo Data of the active wallet's main UTXO, as
    ///        currently known on the Ethereum chain.
    /// @dev Requirements:
    ///      - `activeWalletMainUtxo` components must point to the recent main
    ///        UTXO of the given active wallet, as currently known on the
    ///        Ethereum chain. If there is no active wallet at the moment, or
    ///        the active wallet has no main UTXO, this parameter can be
    ///        empty as it is ignored.
    ///      - Wallet creation must not be in progress
    ///      - If the active wallet is set, one of the following
    ///        conditions must be true:
    ///        - The active wallet BTC balance is above the minimum threshold
    ///          and the active wallet is old enough, i.e. the creation period
    ///           was elapsed since its creation time
    ///        - The active wallet BTC balance is above the maximum threshold
    function requestNewWallet(BitcoinTx.UTXO calldata activeWalletMainUtxo)
        external
    {
        wallets.requestNewWallet(activeWalletMainUtxo);
    }

    /// @notice A callback function that is called by the ECDSA Wallet Registry
    ///         once a new ECDSA wallet is created.
    /// @param ecdsaWalletID Wallet's unique identifier.
    /// @param publicKeyX Wallet's public key's X coordinate.
    /// @param publicKeyY Wallet's public key's Y coordinate.
    /// @dev Requirements:
    ///      - The only caller authorized to call this function is `registry`
    ///      - Given wallet data must not belong to an already registered wallet
    function __ecdsaWalletCreatedCallback(
        bytes32 ecdsaWalletID,
        bytes32 publicKeyX,
        bytes32 publicKeyY
    ) external override {
        wallets.registerNewWallet(ecdsaWalletID, publicKeyX, publicKeyY);
    }

    /// @notice A callback function that is called by the ECDSA Wallet Registry
    ///         once a wallet heartbeat failure is detected.
    /// @param ecdsaWalletID Wallet's unique identifier.
    /// @param publicKeyY Wallet's public key's X coordinate.
    /// @param publicKeyY Wallet's public key's Y coordinate.
    /// @dev Requirements:
    ///      - The only caller authorized to call this function is `registry`
    function __ecdsaWalletHeartbeatFailedCallback(
        bytes32 ecdsaWalletID,
        bytes32 publicKeyX,
        bytes32 publicKeyY
    ) external override {
        wallets.notifyWalletHeartbeatFailed(
            ecdsaWalletID,
            publicKeyX,
            publicKeyY
        );
    }

    /// @notice Gets details about a registered wallet.
    /// @param walletPubKeyHash The 20-byte wallet public key hash (computed
    ///        using Bitcoin HASH160 over the compressed ECDSA public key)
    /// @return Wallet details.
    function getRegisteredWallet(bytes20 walletPubKeyHash)
        external
        view
        returns (Wallets.Wallet memory)
    {
        return wallets.registeredWallets[walletPubKeyHash];
    }

    /// @notice Gets the public key hash of the active wallet.
    /// @return The 20-byte public key hash (computed using Bitcoin HASH160
    ///         over the compressed ECDSA public key) of the active wallet.
    function getActiveWalletPubKeyHash() external view returns (bytes20) {
        return wallets.activeWalletPubKeyHash;
    }

    /// @notice Determines the current Bitcoin SPV proof difficulty context.
    /// @return proofDifficulty Bitcoin proof difficulty context.
    function proofDifficultyContext()
        internal
        view
        returns (BitcoinTx.ProofDifficulty memory proofDifficulty)
    {
        proofDifficulty.currentEpochDifficulty = relay
            .getCurrentEpochDifficulty();
        proofDifficulty.previousEpochDifficulty = relay
            .getPrevEpochDifficulty();
        proofDifficulty.difficultyFactor = txProofDifficultyFactor;

        return proofDifficulty;
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

        // TODO: Validate if `walletPubKeyHash` is a known and live wallet.
        // TODO: Should we enforce a specific locktime at contract level?

        bytes memory expectedScript = abi.encodePacked(
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

        bytes memory fundingOutput = fundingTx
            .outputVector
            .extractOutputAtIndex(reveal.fundingOutputIndex);
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
        bytes32 fundingTxHash = abi
            .encodePacked(
                fundingTx.version,
                fundingTx.inputVector,
                fundingTx.outputVector,
                fundingTx.locktime
            )
            .hash256View();

        DepositRequest storage deposit = deposits[
            uint256(
                keccak256(
                    abi.encodePacked(fundingTxHash, reveal.fundingOutputIndex)
                )
            )
        ];
        require(deposit.revealedAt == 0, "Deposit already revealed");

        uint64 fundingOutputAmount = fundingOutput.extractValue();

        require(
            fundingOutputAmount >= depositDustThreshold,
            "Deposit amount too small"
        );

        deposit.amount = fundingOutputAmount;
        deposit.depositor = reveal.depositor;
        /* solhint-disable-next-line not-rely-on-time */
        deposit.revealedAt = uint32(block.timestamp);
        deposit.vault = reveal.vault;
        deposit.treasuryFee = depositTreasuryFeeDivisor > 0
            ? fundingOutputAmount / depositTreasuryFeeDivisor
            : 0;

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
        bytes32 sweepTxHash = BitcoinTx.validateProof(
            sweepTx,
            sweepProof,
            proofDifficultyContext()
        );

        // Process sweep transaction output and extract its target wallet
        // public key hash and value.
        (
            bytes20 walletPubKeyHash,
            uint64 sweepTxOutputValue
        ) = processSweepTxOutput(sweepTx.outputVector);

        Wallets.Wallet storage wallet = wallets.registeredWallets[
            walletPubKeyHash
        ];

        // TODO: Validate if `walletPubKeyHash` is a known and live wallet.

        // Check if the main UTXO for given wallet exists. If so, validate
        // passed main UTXO data against the stored hash and use them for
        // further processing. If no main UTXO exists, use empty data.
        BitcoinTx.UTXO memory resolvedMainUtxo = BitcoinTx.UTXO(
            bytes32(0),
            0,
            0
        );
        bytes32 mainUtxoHash = wallet.mainUtxoHash;
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

        // Process sweep transaction inputs and extract all information needed
        // to perform deposit bookkeeping.
        SweepTxInputsInfo memory inputsInfo = processSweepTxInputs(
            sweepTx.inputVector,
            resolvedMainUtxo
        );

        // Helper variable that will hold the sum of treasury fees paid by
        // all deposits.
        uint256 totalTreasuryFee = 0;

        // Determine the transaction fee that should be incurred by each deposit
        // and the indivisible remainder that should be additionally incurred
        // by the last deposit.
        (
            uint256 depositTxFee,
            uint256 depositTxFeeRemainder
        ) = sweepTxFeeDistribution(
                inputsInfo.inputsTotalValue,
                sweepTxOutputValue,
                inputsInfo.depositedAmounts.length
            );

        // Make sure the highest value of the deposit transaction fee does not
        // exceed the maximum value limited by the governable parameter.
        require(
            depositTxFee + depositTxFeeRemainder <= depositTxMaxFee,
            "Transaction fee is too high"
        );

        // Reduce each deposit amount by treasury fee and transaction fee.
        for (uint256 i = 0; i < inputsInfo.depositedAmounts.length; i++) {
            // The last deposit should incur the deposit transaction fee
            // remainder.
            uint256 depositTxFeeIncurred = i ==
                inputsInfo.depositedAmounts.length - 1
                ? depositTxFee + depositTxFeeRemainder
                : depositTxFee;

            // There is no need to check whether
            // `inputsInfo.depositedAmounts[i] - inputsInfo.treasuryFees[i] - txFee > 0`
            // since the `depositDustThreshold` should force that condition
            // to be always true.
            inputsInfo.depositedAmounts[i] =
                inputsInfo.depositedAmounts[i] -
                inputsInfo.treasuryFees[i] -
                depositTxFeeIncurred;
            totalTreasuryFee += inputsInfo.treasuryFees[i];
        }

        // Record this sweep data and assign them to the wallet public key hash
        // as new main UTXO. Transaction output index is always 0 as sweep
        // transaction always contains only one output.
        wallet.mainUtxoHash = keccak256(
            abi.encodePacked(sweepTxHash, uint32(0), sweepTxOutputValue)
        );

        emit DepositsSwept(walletPubKeyHash, sweepTxHash);

        // Update depositors balances in the Bank.
        bank.increaseBalances(
            inputsInfo.depositors,
            inputsInfo.depositedAmounts
        );
        // Pass the treasury fee to the treasury address.
        bank.increaseBalance(treasury, totalTreasuryFee);

        // TODO: Handle deposits having `vault` set.
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
    /// @return info Outcomes of the processing.
    function processSweepTxInputs(
        bytes memory sweepTxInputVector,
        BitcoinTx.UTXO memory mainUtxo
    ) internal returns (SweepTxInputsInfo memory info) {
        // If the passed `mainUtxo` parameter's values are zeroed, the main UTXO
        // for the given wallet doesn't exist and it is not expected to be
        // included in the sweep transaction input vector.
        bool mainUtxoExpected = mainUtxo.txHash != bytes32(0);
        bool mainUtxoFound = false;

        // Determining the total number of sweep transaction inputs in the same
        // way as for number of outputs. See `BitcoinTx.inputVector` docs for
        // more details.
        (
            uint256 inputsCompactSizeUintLength,
            uint256 inputsCount
        ) = sweepTxInputVector.parseVarInt();

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
        info.depositors = new address[](
            !mainUtxoExpected ? inputsCount : inputsCount - 1
        );
        info.depositedAmounts = new uint256[](info.depositors.length);
        info.treasuryFees = new uint256[](info.depositors.length);

        // Initialize helper variables.
        uint256 processedDepositsCount = 0;

        // Inputs processing loop.
        for (uint256 i = 0; i < inputsCount; i++) {
            (
                bytes32 outpointTxHash,
                uint32 outpointIndex,
                uint256 inputLength
            ) = parseTxInputAt(sweepTxInputVector, inputStartingIndex);

            DepositRequest storage deposit = deposits[
                uint256(
                    keccak256(abi.encodePacked(outpointTxHash, outpointIndex))
                )
            ];

            if (deposit.revealedAt != 0) {
                // If we entered here, that means the input was identified as
                // a revealed deposit.
                require(deposit.sweptAt == 0, "Deposit already swept");

                if (processedDepositsCount == info.depositors.length) {
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

                info.depositors[processedDepositsCount] = deposit.depositor;
                info.depositedAmounts[processedDepositsCount] = deposit.amount;
                info.inputsTotalValue += info.depositedAmounts[
                    processedDepositsCount
                ];
                info.treasuryFees[processedDepositsCount] = deposit.treasuryFee;

                processedDepositsCount++;
            } else if (
                mainUtxoExpected != mainUtxoFound &&
                mainUtxo.txHash == outpointTxHash
            ) {
                // If we entered here, that means the input was identified as
                // the expected main UTXO.
                info.inputsTotalValue += mainUtxo.txOutputValue;
                mainUtxoFound = true;
            } else {
                revert("Unknown input type");
            }

            // Make the `inputStartingIndex` pointing to the next input by
            // increasing it by current input's length.
            inputStartingIndex += inputLength;
        }

        // Construction of the input processing loop guarantees that:
        // `processedDepositsCount == info.depositors.length == info.depositedAmounts.length`
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

        return info;
    }

    /// @notice Parses a Bitcoin transaction input starting at the given index.
    /// @param inputVector Bitcoin transaction input vector
    /// @param inputStartingIndex Index the given input starts at
    /// @return outpointTxHash 32-byte hash of the Bitcoin transaction which is
    ///         pointed in the given input's outpoint.
    /// @return outpointIndex 4-byte index of the Bitcoin transaction output
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
            bytes32 outpointTxHash,
            uint32 outpointIndex,
            uint256 inputLength
        )
    {
        outpointTxHash = inputVector.extractInputTxIdLeAt(inputStartingIndex);

        outpointIndex = BTCUtils.reverseUint32(
            uint32(inputVector.extractTxIndexLeAt(inputStartingIndex))
        );

        inputLength = inputVector.determineInputLengthAt(inputStartingIndex);

        return (outpointTxHash, outpointIndex, inputLength);
    }

    /// @notice Determines the distribution of the sweep transaction fee
    ///         over swept deposits.
    /// @param sweepTxInputsTotalValue Total value of all sweep transaction inputs.
    /// @param sweepTxOutputValue Value of the sweep transaction output.
    /// @param depositsCount Count of the deposits swept by the sweep transaction.
    /// @return depositTxFee Transaction fee per deposit determined by evenly
    ///         spreading the divisible part of the sweep transaction fee
    ///         over all deposits.
    /// @return depositTxFeeRemainder The indivisible part of the sweep
    ///         transaction fee than cannot be distributed over all deposits.
    /// @dev It is up to the caller to decide how the remainder should be
    ///      counted in. This function only computes its value.
    function sweepTxFeeDistribution(
        uint256 sweepTxInputsTotalValue,
        uint256 sweepTxOutputValue,
        uint256 depositsCount
    )
        internal
        pure
        returns (uint256 depositTxFee, uint256 depositTxFeeRemainder)
    {
        // The sweep transaction fee is just the difference between inputs
        // amounts sum and the output amount.
        uint256 sweepTxFee = sweepTxInputsTotalValue - sweepTxOutputValue;
        // Compute the indivisible remainder that remains after dividing the
        // sweep transaction fee over all deposits evenly.
        depositTxFeeRemainder = sweepTxFee % depositsCount;
        // Compute the transaction fee per deposit by dividing the sweep
        // transaction fee (reduced by the remainder) by the number of deposits.
        depositTxFee = (sweepTxFee - depositTxFeeRemainder) / depositsCount;

        return (depositTxFee, depositTxFeeRemainder);
    }

    /// @notice Requests redemption of the given amount from the specified
    ///         wallet to the redeemer Bitcoin output script.
    /// @param walletPubKeyHash The 20-byte wallet public key hash (computed
    ///        using Bitcoin HASH160 over the compressed ECDSA public key)
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain
    /// @param redeemerOutputScript The redeemer's length-prefixed output
    ///        script (P2PKH, P2WPKH, P2SH or P2WSH) that will be used to lock
    ///        redeemed BTC
    /// @param amount Requested amount in satoshi. This is also the TBTC amount
    ///        that is taken from redeemer's balance in the Bank upon request.
    ///        Once the request is handled, the actual amount of BTC locked
    ///        on the redeemer output script will be always lower than this value
    ///        since the treasury and Bitcoin transaction fees must be incurred.
    ///        The minimal amount satisfying the request can be computed as:
    ///        `amount - (amount / redemptionTreasuryFeeDivisor) - redemptionTxMaxFee`.
    ///        Fees values are taken at the moment of request creation.
    /// @dev Requirements:
    ///      - Wallet behind `walletPubKeyHash` must be live
    ///      - `mainUtxo` components must point to the recent main UTXO
    ///        of the given wallet, as currently known on the Ethereum chain.
    ///      - `redeemerOutputScript` must be a proper Bitcoin script
    ///      - `redeemerOutputScript` cannot have wallet PKH as payload
    ///      - `amount` must be above or equal the `redemptionDustThreshold`
    ///      - Given `walletPubKeyHash` and `redeemerOutputScript` pair can be
    ///        used for only one pending request at the same time
    ///      - Wallet must have enough Bitcoin balance to proceed the request
    ///      - Redeemer must make an allowance in the Bank that the Bridge
    ///        contract can spend the given `amount`.
    function requestRedemption(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes calldata redeemerOutputScript,
        uint64 amount
    ) external {
        Wallets.Wallet storage wallet = wallets.registeredWallets[
            walletPubKeyHash
        ];

        require(
            wallet.state == Wallets.WalletState.Live,
            "Wallet must be in Live state"
        );

        bytes32 mainUtxoHash = wallet.mainUtxoHash;
        require(
            mainUtxoHash != bytes32(0),
            "No main UTXO for the given wallet"
        );
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

        // TODO: Confirm if `walletPubKeyHash` should be validated by checking
        //       if it is the oldest one who can handle the request. This will
        //       be suggested by the dApp but may not be respected by users who
        //       interact directly with the contract. Do we need to enforce it
        //       here? One option is not to enforce it, to save on gas, but if
        //       we see this rule is not respected, upgrade Bridge contract to
        //       require it.

        // Validate if redeemer output script is a correct standard type
        // (P2PKH, P2WPKH, P2SH or P2WSH). This is done by building a stub
        // output with 0 as value and using `BTCUtils.extractHash` on it. Such
        // a function extracts the payload properly only from standard outputs
        // so if it succeeds, we have a guarantee the redeemer output script
        // is proper. Worth to note `extractHash` ignores the value at all
        // so this is why we can use 0 safely. This way of validation is the
        // same as in tBTC v1.
        bytes memory redeemerOutputScriptPayload = abi
            .encodePacked(bytes8(0), redeemerOutputScript)
            .extractHash();
        require(
            redeemerOutputScriptPayload.length > 0,
            "Redeemer output script must be a standard type"
        );
        // Check if the redeemer output script payload does not point to the
        // wallet public key hash.
        require(
            keccak256(abi.encodePacked(walletPubKeyHash)) !=
                keccak256(redeemerOutputScriptPayload),
            "Redeemer output script must not point to the wallet PKH"
        );

        require(
            amount >= redemptionDustThreshold,
            "Redemption amount too small"
        );

        // The redemption key is built on top of the wallet public key hash
        // and redeemer output script pair. That means there can be only one
        // request asking for redemption from the given wallet to the given
        // BTC script at the same time.
        uint256 redemptionKey = uint256(
            keccak256(abi.encodePacked(walletPubKeyHash, redeemerOutputScript))
        );

        // Check if given redemption key is not used by a pending redemption.
        // There is no need to check for existence in `timedOutRedemptions`
        // since the wallet's state is changed to other than Live after
        // first time out is reported so making new requests is not possible.
        // slither-disable-next-line incorrect-equality
        require(
            pendingRedemptions[redemptionKey].requestedAt == 0,
            "There is a pending redemption request from this wallet to the same address"
        );

        // No need to check whether `amount - treasuryFee - txMaxFee > 0`
        // since the `redemptionDustThreshold` should force that condition
        // to be always true.
        uint64 treasuryFee = redemptionTreasuryFeeDivisor > 0
            ? amount / redemptionTreasuryFeeDivisor
            : 0;
        uint64 txMaxFee = redemptionTxMaxFee;

        // The main wallet UTXO's value doesn't include all pending redemptions.
        // To determine if the requested redemption can be performed by the
        // wallet we need to subtract the total value of all pending redemptions
        // from that wallet's main UTXO value. Given that the treasury fee is
        // not redeemed from the wallet, we are subtracting it.
        wallet.pendingRedemptionsValue += amount - treasuryFee;
        require(
            mainUtxo.txOutputValue >= wallet.pendingRedemptionsValue,
            "Insufficient wallet funds"
        );

        pendingRedemptions[redemptionKey] = RedemptionRequest(
            msg.sender,
            amount,
            treasuryFee,
            txMaxFee,
            /* solhint-disable-next-line not-rely-on-time */
            uint32(block.timestamp)
        );

        emit RedemptionRequested(
            walletPubKeyHash,
            redeemerOutputScript,
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
    ///         the total redeemed Bitcoin amount from Bridge balance and
    ///         transferring the treasury fee sum to the treasury address.
    ///
    ///         It is possible to prove the given redemption only one time.
    /// @param redemptionTx Bitcoin redemption transaction data
    /// @param redemptionProof Bitcoin redemption proof data
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    ///        HASH160 over the compressed ECDSA public key) of the wallet which
    ///        performed the redemption transaction
    /// @dev Requirements:
    ///      - `redemptionTx` components must match the expected structure. See
    ///        `BitcoinTx.Info` docs for reference. Their values must exactly
    ///        correspond to appropriate Bitcoin transaction fields to produce
    ///        a provable transaction hash.
    ///      - The `redemptionTx` should represent a Bitcoin transaction with
    ///        exactly 1 input that refers to the wallet's main UTXO. That
    ///        transaction should have 1..n outputs handling existing pending
    ///        redemption requests or pointing to reported timed out requests.
    ///        There can be also 1 optional output representing the
    ///        change and pointing back to the 20-byte wallet public key hash.
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
    ///      Other remarks:
    ///      - Putting the change output as the first transaction output can
    ///        save some gas because the output processing loop begins each
    ///        iteration by checking whether the given output is the change
    ///        thus uses some gas for making the comparison. Once the change
    ///        is identified, that check is omitted in further iterations.
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
        bytes32 redemptionTxHash = BitcoinTx.validateProof(
            redemptionTx,
            redemptionProof,
            proofDifficultyContext()
        );

        // Perform validation of the redemption transaction input. Specifically,
        // check if it refers to the expected wallet's main UTXO.
        validateRedemptionTxInput(
            redemptionTx.inputVector,
            mainUtxo,
            walletPubKeyHash
        );

        Wallets.Wallet storage wallet = wallets.registeredWallets[
            walletPubKeyHash
        ];

        Wallets.WalletState walletState = wallet.state;
        require(
            walletState == Wallets.WalletState.Live ||
                walletState == Wallets.WalletState.MovingFunds,
            "Wallet must be in Live or MovingFuds state"
        );

        // Process redemption transaction outputs to extract some info required
        // for further processing.
        RedemptionTxOutputsInfo memory outputsInfo = processRedemptionTxOutputs(
            redemptionTx.outputVector,
            walletPubKeyHash
        );

        if (outputsInfo.changeValue > 0) {
            // If the change value is grater than zero, it means the change
            // output exists and can be used as new wallet's main UTXO.
            wallet.mainUtxoHash = keccak256(
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
            delete wallet.mainUtxoHash;
        }

        wallet.pendingRedemptionsValue -= outputsInfo.totalBurnableValue;

        emit RedemptionsCompleted(walletPubKeyHash, redemptionTxHash);

        bank.decreaseBalance(outputsInfo.totalBurnableValue);
        bank.transferBalance(treasury, outputsInfo.totalTreasuryFee);
    }

    /// @notice Validates whether the redemption Bitcoin transaction input
    ///         vector contains a single input referring to the wallet's main
    ///         UTXO. Reverts in case the validation fails.
    /// @param redemptionTxInputVector Bitcoin redemption transaction input
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVin` function
    ///        before it is passed here
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain.
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    //         HASH160 over the compressed ECDSA public key) of the wallet which
    ///        performed the redemption transaction.
    function validateRedemptionTxInput(
        bytes memory redemptionTxInputVector,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes20 walletPubKeyHash
    ) internal view {
        // Assert that main UTXO for passed wallet exists in storage.
        bytes32 mainUtxoHash = wallets
            .registeredWallets[walletPubKeyHash]
            .mainUtxoHash;
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
        (
            bytes32 redemptionTxOutpointTxHash,
            uint32 redemptionTxOutpointIndex
        ) = processRedemptionTxInput(redemptionTxInputVector);
        require(
            mainUtxo.txHash == redemptionTxOutpointTxHash &&
                mainUtxo.txOutputIndex == redemptionTxOutpointIndex,
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
    /// @return outpointTxHash 32-byte hash of the Bitcoin transaction which is
    ///         pointed in the input's outpoint.
    /// @return outpointIndex 4-byte index of the Bitcoin transaction output
    ///         which is pointed in the input's outpoint.
    function processRedemptionTxInput(bytes memory redemptionTxInputVector)
        internal
        pure
        returns (bytes32 outpointTxHash, uint32 outpointIndex)
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

        outpointTxHash = input.extractInputTxIdLE();

        outpointIndex = BTCUtils.reverseUint32(
            uint32(input.extractTxIndexLE())
        );

        // There is only one input in the transaction. Input has an outpoint
        // field that is a reference to the transaction being spent (see
        // `BitcoinTx` docs). The outpoint contains the hash of the transaction
        // to spend (`outpointTxHash`) and the index of the specific output
        // from that transaction (`outpointIndex`).
        return (outpointTxHash, outpointIndex);
    }

    /// @notice Processes the Bitcoin redemption transaction output vector.
    ///         It extracts each output and tries to identify it as a pending
    ///         redemption request, reported timed out request, or change.
    ///         Reverts if one of the outputs cannot be recognized properly.
    ///         This function also marks each request as processed by removing
    ///         them from `pendingRedemptions` mapping.
    /// @param redemptionTxOutputVector Bitcoin redemption transaction output
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVout` function
    ///        before it is passed here
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    //         HASH160 over the compressed ECDSA public key) of the wallet which
    ///        performed the redemption transaction.
    /// @return info Outcomes of the processing.
    function processRedemptionTxOutputs(
        bytes memory redemptionTxOutputVector,
        bytes20 walletPubKeyHash
    ) internal returns (RedemptionTxOutputsInfo memory info) {
        // Determining the total number of redemption transaction outputs in
        // the same way as for number of inputs. See `BitcoinTx.outputVector`
        // docs for more details.
        (
            uint256 outputsCompactSizeUintLength,
            uint256 outputsCount
        ) = redemptionTxOutputVector.parseVarInt();

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

        // Calculate the keccak256 for two possible wallet's P2PKH or P2WPKH
        // scripts that can be used to lock the change. This is done upfront to
        // save on gas. Both scripts have a strict format defined by Bitcoin.
        //
        // The P2PKH script has format <0x1976a914> <20-byte PKH> <0x88ac>.
        bytes32 walletP2PKHScriptKeccak = keccak256(
            abi.encodePacked(hex"1976a914", walletPubKeyHash, hex"88ac")
        );
        // The P2WPKH script has format <0x160014> <20-byte PKH>.
        bytes32 walletP2WPKHScriptKeccak = keccak256(
            abi.encodePacked(hex"160014", walletPubKeyHash)
        );

        // Helper variable that counts the number of processed redemption
        // outputs. Redemptions can be either pending or reported as timed out.
        // TODO: Revisit the approach with redemptions count according to
        //       https://github.com/keep-network/tbtc-v2/pull/128#discussion_r808237765
        uint256 processedRedemptionsCount = 0;

        // Outputs processing loop.
        for (uint256 i = 0; i < outputsCount; i++) {
            // TODO: Check if we can optimize gas costs by adding
            //       `extractValueAt` and `extractHashAt` in `bitcoin-spv-sol`
            //       in order to avoid allocating bytes in memory.
            uint256 outputLength = redemptionTxOutputVector
                .determineOutputLengthAt(outputStartingIndex);
            bytes memory output = redemptionTxOutputVector.slice(
                outputStartingIndex,
                outputLength
            );

            // Extract the value from given output.
            uint64 outputValue = output.extractValue();
            // The output consists of an 8-byte value and a variable length
            // script. To extract that script we slice the output staring from
            // 9th byte until the end.
            bytes memory outputScript = output.slice(8, output.length - 8);

            if (
                info.changeValue == 0 &&
                (keccak256(outputScript) == walletP2PKHScriptKeccak ||
                    keccak256(outputScript) == walletP2WPKHScriptKeccak) &&
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
                uint256 redemptionKey = uint256(
                    keccak256(abi.encodePacked(walletPubKeyHash, outputScript))
                );

                if (pendingRedemptions[redemptionKey].requestedAt != 0) {
                    // If we entered here, that means the output was identified
                    // as a pending redemption request.
                    RedemptionRequest storage request = pendingRedemptions[
                        redemptionKey
                    ];
                    // Compute the request's redeemable amount as the requested
                    // amount reduced by the treasury fee. The request's
                    // minimal amount is then the redeemable amount reduced by
                    // the maximum transaction fee.
                    uint64 redeemableAmount = request.requestedAmount -
                        request.treasuryFee;
                    // Output value must fit between the request's redeemable
                    // and minimal amounts to be deemed valid.
                    require(
                        redeemableAmount - request.txMaxFee <= outputValue &&
                            outputValue <= redeemableAmount,
                        "Output value is not within the acceptable range of the pending request"
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
                    delete pendingRedemptions[redemptionKey];

                    processedRedemptionsCount++;
                } else {
                    // If we entered here, the output is not a redemption
                    // request but there is still a chance the given output is
                    // related to a reported timed out redemption request.
                    // If so, check if the output value matches the request
                    // amount to confirm this is an overdue request fulfillment
                    // then bypass this output and process the subsequent
                    // ones. That also means the wallet was already punished
                    // for the inactivity. Otherwise, just revert.
                    RedemptionRequest storage request = timedOutRedemptions[
                        redemptionKey
                    ];

                    require(
                        request.requestedAt != 0,
                        "Output is a non-requested redemption"
                    );

                    uint64 redeemableAmount = request.requestedAmount -
                        request.treasuryFee;

                    require(
                        redeemableAmount - request.txMaxFee <= outputValue &&
                            outputValue <= redeemableAmount,
                        "Output value is not within the acceptable range of the timed out request"
                    );

                    processedRedemptionsCount++;
                }
            }

            // Make the `outputStartingIndex` pointing to the next output by
            // increasing it by current output's length.
            outputStartingIndex += outputLength;
        }

        // Protect against the cases when there is only a single change output
        // referring back to the wallet PKH and just burning main UTXO value
        // for transaction fees.
        require(
            processedRedemptionsCount > 0,
            "Redemption transaction must process at least one redemption"
        );

        return info;
    }

    // TODO: Function `notifyRedemptionTimeout. That function must:
    //       1. Take a the `walletPubKey` and `redeemerOutputScript` as params.
    //       2. Build the redemption key using those params.
    //       3. Use the redemption key and take the request from
    //          `pendingRedemptions` mapping.
    //       4. If request doesn't exist in mapping - revert.
    //       5. If request exits, and is timed out - remove the redemption key
    //          from `pendingRedemptions` and put it to `timedOutRedemptions`
    //          by copying the entire `RedemptionRequest` struct there. No need
    //          to check if `timedOutRedemptions` mapping already contains
    //          that key because `requestRedemption` blocks requests targeting
    //          non-live wallets. Because `notifyRedemptionTimeout` changes
    //          wallet state after first call (point 9), there is no possibility
    //          that the given redemption key could be reported as timed out
    //          multiple times. At the same time, if the given redemption key
    //          was already marked as fraudulent due to an amount-related fraud,
    //          it will not be possible to report a time out on it since it
    //          won't be present in `pendingRedemptions` mapping.
    //       6. Return the `requestedAmount` to the `redeemer`.
    //       7. Reduce the `pendingRedemptionsValue` (`wallets` mapping) for
    //          given wallet by request's redeemable amount computed as
    //          `requestedAmount - treasuryFee`.
    //       8. Punish the wallet, probably by slashing its operators.
    //       9. Change wallet's state in `wallets` mapping to `MovingFunds` in
    //          order to prevent against new redemption requests hitting
    //          that wallet.
    //      10. Expect the wallet to transfer its funds to another healthy
    //          wallet (just as in case of failed heartbeat). The wallet is
    //          expected to finish the already queued redemption requests
    //          before moving funds but we are not going to enforce it on-chain.

    // TODO: Function `submitRedemptionFraudProof`
    //
    //       Deposit and redemption fraud proofs are challenging to implement
    //       and it may happen we will have to rely on the coverage pool
    //       (https://github.com/keep-network/coverage-pools) and DAO to
    //       reimburse unlucky depositors and bring back the balance to the
    //       system in case  of a wallet fraud by liquidating a part of the
    //       coverage pool manually.
    //
    //       The probability of 51-of-100 wallet being fraudulent is negligible:
    //       https://github.com/keep-network/tbtc-v2/blob/main/docs/rfc/rfc-2.adoc#111-group-size-and-threshold
    //       and the coverage pool would be there to bring the balance back in
    //       case we are unlucky and malicious wallet emerges.
    //
    //       We do not want to slash for a misbehavior that is not provable
    //       on-chain and it is possible to construct such a Bitcoin transaction
    //       that is not provable on Ethereum, see
    //       https://consensys.net/diligence/blog/2020/05/tbtc-navigating-the-cross-chain-conundrum
    //
    //       The algorithm described below assumes we will be able to prove the
    //       TX on Ethereum which may not always be the case. Consider the steps
    //       below as an idea, and not necessarily how this function will be
    //       implemented because it may happen this function will never be
    //       implemented, given the Bitcoin transaction size problems.
    //
    //       The algorithm:
    //       1. Take a `BitcoinTx.Info` and `BitcoinTx.Proof` of the
    //          fraudulent transaction. It should also accept `walletPubKeyHash`
    //          and index of fraudulent output. Probably index of fraudulent
    //          input will be also required if the transaction is supposed
    //          to have a bad input vector.
    //       2. Perform SPV proof to make sure it occurred on Bitcoin chain.
    //          If not - revert.
    //       3. Check if wallet state is Live or MovingFunds. If not, revert.
    //       4. Validate the number of inputs. If there is one input and it
    //          points to the wallet's main UTXO - move to point 5. If there
    //          are multiple inputs and there is wallet's main UTXO in the set,
    //          check if this is  a sweep transaction. If it's not a sweep,
    //          consider it as fraudulent and move to point 6.
    //          In all other cases revert the call.
    //       5. Extract the output and analyze its type. The output is not
    //          a fraud and the call should be reverted ONLY IF one of the
    //          following conditions is true:
    //          - Output is a requested redemption held by `pendingRedemptions`
    //            and output value fulfills the request range. There is an
    //            open question if a misfunded request should be removed
    //            from `pendingRedemptions` (probably yes) and whether the
    //            redeemer should be reimbursed in case of an underfund.
    //          - Output is a timed out redemption held by `timedOutRedemptions`
    //            and output value fulfills the request range.
    //          - Output is a proper change i.e. a single output targeting
    //            the wallet PKH back and having a non-zero value.
    //          - Wallet is in MovingFunds state, the output points to the
    //            expected target wallet, have non-zero value, and is a single
    //            output in the vector.
    //          In all other cases consider the transaction as fraud and
    //          proceed to point 6.
    //       6. Punish the wallet, probably by severely slashing its operators.
    //       7. Change wallet's state in `wallets` mapping to `Terminated` in
    //          order to prevent against new redemption requests hitting
    //          that wallet. This also prevents against reporting a fraud
    //          multiple times for one transaction (see point 3) and blocks
    //          submission of sweep and redemption proofs. `Terminated` wallet
    //          is blocked in the Bridge forever. If the fraud was a mistake
    //          done by the wallet and the wallet is still honest deep in its
    //          heart, the wallet can coordinate off-chain to recover the BTC
    //          and donate it to another wallet. If they recover all of the
    //          remaining BTC, DAO might decide to reward them with tokens so
    //          that they can have at least some portion of their slashed
    //          tokens back.
}
