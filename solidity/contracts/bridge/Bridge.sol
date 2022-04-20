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

import "./IRelay.sol";
import "./BridgeState.sol";
import "./Deposit.sol";
import "./Sweep.sol";
import "./Redeem.sol";
import "./BitcoinTx.sol";
import "./EcdsaLib.sol";
import "./Wallets.sol";
import "./Fraud.sol";
import "./MovingFunds.sol";

import "../bank/Bank.sol";

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
///
// TODO: All wallets-related operations that are currently done directly
//       by the Bridge can be probably delegated to the Wallets library.
//       Examples of such operations are main UTXO or pending redemptions
//       value updates.
contract Bridge is Ownable, EcdsaWalletOwner {
    using BridgeState for BridgeState.Storage;
    using Deposit for BridgeState.Storage;
    using Sweep for BridgeState.Storage;
    using Redeem for BridgeState.Storage;
    using MovingFunds for BridgeState.Storage;
    using Fraud for BridgeState.Storage;
    using Wallets for BridgeState.Storage;

    using BTCUtils for bytes;
    using BTCUtils for uint256;
    using BytesLib for bytes;

    BridgeState.Storage internal self;

    event WalletParametersUpdated(
        uint32 walletCreationPeriod,
        uint64 walletMinBtcBalance,
        uint64 walletMaxBtcBalance,
        uint32 walletMaxAge
    );

    event WalletMaxBtcTransferUpdated(uint64 newMaxBtcTransfer);

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

    event WalletTerminated(
        bytes32 indexed ecdsaWalletID,
        bytes20 indexed walletPubKeyHash
    );

    event VaultStatusUpdated(address indexed vault, bool isTrusted);

    event FraudSlashingAmountUpdated(uint256 newFraudSlashingAmount);

    event FraudNotifierRewardMultiplierUpdated(
        uint256 newFraudNotifierRewardMultiplier
    );

    event FraudChallengeDefeatTimeoutUpdated(
        uint256 newFraudChallengeDefeatTimeout
    );

    event FraudChallengeDepositAmountUpdated(
        uint256 newFraudChallengeDepositAmount
    );

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

    event RedemptionTimedOut(
        bytes20 walletPubKeyHash,
        bytes redeemerOutputScript
    );

    event FraudChallengeSubmitted(
        bytes20 walletPublicKeyHash,
        bytes32 sighash,
        uint8 v,
        bytes32 r,
        bytes32 s
    );

    event FraudChallengeDefeated(bytes20 walletPublicKeyHash, bytes32 sighash);

    event FraudChallengeDefeatTimedOut(
        bytes20 walletPublicKeyHash,
        bytes32 sighash
    );

    event MovingFundsCompleted(
        bytes20 walletPubKeyHash,
        bytes32 movingFundsTxHash
    );

    constructor(
        address _bank,
        address _relay,
        address _treasury,
        address _ecdsaWalletRegistry,
        uint256 _txProofDifficultyFactor
    ) {
        require(_bank != address(0), "Bank address cannot be zero");
        self.bank = Bank(_bank);

        require(_relay != address(0), "Relay address cannot be zero");
        self.relay = IRelay(_relay);

        require(
            _ecdsaWalletRegistry != address(0),
            "ECDSA Wallet Registry address cannot be zero"
        );
        self.ecdsaWalletRegistry = EcdsaWalletRegistry(_ecdsaWalletRegistry);

        require(_treasury != address(0), "Treasury address cannot be zero");
        self.treasury = _treasury;

        self.txProofDifficultyFactor = _txProofDifficultyFactor;

        // TODO: Revisit initial values.
        self.depositDustThreshold = 1000000; // 1000000 satoshi = 0.01 BTC
        self.depositTxMaxFee = 10000; // 10000 satoshi
        self.depositTreasuryFeeDivisor = 2000; // 1/2000 == 5bps == 0.05% == 0.0005
        self.redemptionDustThreshold = 1000000; // 1000000 satoshi = 0.01 BTC
        self.redemptionTreasuryFeeDivisor = 2000; // 1/2000 == 5bps == 0.05% == 0.0005
        self.redemptionTxMaxFee = 10000; // 10000 satoshi
        self.redemptionTimeout = 172800; // 48 hours
        self.movingFundsTxMaxTotalFee = 10000; // 10000 satoshi
        self.fraudSlashingAmount = 10000 * 1e18; // 10000 T
        self.fraudNotifierRewardMultiplier = 100; // 100%
        self.fraudChallengeDefeatTimeout = 7 days;
        self.fraudChallengeDepositAmount = 2 ether;
        self.walletCreationPeriod = 1 weeks;
        self.walletMinBtcBalance = 1e8; // 1 BTC
        self.walletMaxBtcBalance = 10e8; // 10 BTC
        self.walletMaxAge = 26 weeks; // ~6 months
        self.walletMaxBtcTransfer = 10e8; // 10 BTC
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
        self.isVaultTrusted[vault] = isTrusted;
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
    ///          was elapsed since its creation time
    ///        - The active wallet BTC balance is above the maximum threshold
    function requestNewWallet(BitcoinTx.UTXO calldata activeWalletMainUtxo)
        external
    {
        self.requestNewWallet(activeWalletMainUtxo);
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
        self.registerNewWallet(ecdsaWalletID, publicKeyX, publicKeyY);
    }

    /// @notice A callback function that is called by the ECDSA Wallet Registry
    ///         once a wallet heartbeat failure is detected.
    /// @param publicKeyX Wallet's public key's X coordinate
    /// @param publicKeyY Wallet's public key's Y coordinate
    /// @dev Requirements:
    ///      - The only caller authorized to call this function is `registry`
    ///      - Wallet must be in Live state
    function __ecdsaWalletHeartbeatFailedCallback(
        bytes32,
        bytes32 publicKeyX,
        bytes32 publicKeyY
    ) external override {
        self.notifyWalletHeartbeatFailed(publicKeyX, publicKeyY);
    }

    /// @notice Notifies that the wallet is either old enough or has too few
    ///         satoshis left and qualifies to be closed.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @param walletMainUtxo Data of the wallet's main UTXO, as currently
    ///        known on the Ethereum chain.
    /// @dev Requirements:
    ///      - Wallet must not be set as the current active wallet
    ///      - Wallet must exceed the wallet maximum age OR the wallet BTC
    ///        balance must be lesser than the minimum threshold. If the latter
    ///        case is true, the `walletMainUtxo` components must point to the
    ///        recent main UTXO of the given wallet, as currently known on the
    ///        Ethereum chain. If the wallet has no main UTXO, this parameter
    ///        can be empty as it is ignored since the wallet balance is
    ///        assumed to be zero.
    ///      - Wallet must be in Live state
    function notifyCloseableWallet(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata walletMainUtxo
    ) external {
        self.notifyCloseableWallet(walletPubKeyHash, walletMainUtxo);
    }

    /// @notice Gets details about a registered wallet.
    /// @param walletPubKeyHash The 20-byte wallet public key hash (computed
    ///        using Bitcoin HASH160 over the compressed ECDSA public key)
    /// @return Wallet details.
    function getWallet(bytes20 walletPubKeyHash)
        external
        view
        returns (Wallets.Wallet memory)
    {
        return self.registeredWallets[walletPubKeyHash];
    }

    /// @notice Gets the public key hash of the active wallet.
    /// @return The 20-byte public key hash (computed using Bitcoin HASH160
    ///         over the compressed ECDSA public key) of the active wallet.
    ///         Returns bytes20(0) if there is no active wallet at the moment.
    function getActiveWalletPubKeyHash() external view returns (bytes20) {
        return self.activeWalletPubKeyHash;
    }

    /// @return Current count of wallets being in the Live state.
    function getLiveWalletsCount() external view returns (uint32) {
        return self.liveWalletsCount;
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
    ///      - `reveal.walletPubKeyHash` must identify a `Live` wallet
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
        Deposit.DepositRevealInfo calldata reveal
    ) external {
        self.revealDeposit(fundingTx, reveal);
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
        self.submitSweepProof(sweepTx, sweepProof, mainUtxo);
    }

    /// @notice Submits a fraud challenge indicating that a UTXO being under
    ///         wallet control was unlocked by the wallet but was not used
    ///         according to the protocol rules. That means the wallet signed
    ///         a transaction input pointing to that UTXO and there is a unique
    ///         sighash and signature pair associated with that input. This
    ///         function uses those parameters to create a fraud accusation that
    ///         proves a given transaction input unlocking the given UTXO was
    ///         actually signed by the wallet. This function cannot determine
    ///         whether the transaction was actually broadcast and the input was
    ///         consumed in a fraudulent way so it just opens a challenge period
    ///         during which the wallet can defeat the challenge by submitting
    ///         proof of a transaction that consumes the given input according
    ///         to protocol rules. To prevent spurious allegations, the caller
    ///         must deposit ETH that is returned back upon justified fraud
    ///         challenge or confiscated otherwise.
    ///@param walletPublicKey The public key of the wallet in the uncompressed
    ///       and unprefixed format (64 bytes)
    /// @param sighash The hash that was used to produce the ECDSA signature
    ///        that is the subject of the fraud claim. This hash is constructed
    ///        by applying double SHA-256 over a serialized subset of the
    ///        transaction. The exact subset used as hash preimage depends on
    ///        the transaction input the signature is produced for. See BIP-143
    ///        for reference
    /// @param signature Bitcoin signature in the R/S/V format
    /// @dev Requirements:
    ///      - Wallet behind `walletPubKey` must be in `Live` or `MovingFunds`
    ///        state
    ///      - The challenger must send appropriate amount of ETH used as
    ///        fraud challenge deposit
    ///      - The signature (represented by r, s and v) must be generated by
    ///        the wallet behind `walletPubKey` during signing of `sighash`
    ///      - Wallet can be challenged for the given signature only once
    function submitFraudChallenge(
        bytes calldata walletPublicKey,
        bytes32 sighash,
        BitcoinTx.RSVSignature calldata signature
    ) external payable {
        self.submitFraudChallenge(walletPublicKey, sighash, signature);
    }

    /// @notice Allows to defeat a pending fraud challenge against a wallet if
    ///         the transaction that spends the UTXO follows the protocol rules.
    ///         In order to defeat the challenge the same `walletPublicKey` and
    ///         signature (represented by `r`, `s` and `v`) must be provided as
    ///         were used to calculate the sighash during input signing.
    ///         The fraud challenge defeat attempt will only succeed if the
    ///         inputs in the preimage are considered honestly spent by the
    ///         wallet. Therefore the transaction spending the UTXO must be
    ///         proven in the Bridge before a challenge defeat is called.
    ///         If successfully defeated, the fraud challenge is marked as
    ///         resolved and the amount of ether deposited by the challenger is
    ///         sent to the treasury.
    /// @param walletPublicKey The public key of the wallet in the uncompressed
    ///        and unprefixed format (64 bytes)
    /// @param preimage The preimage which produces sighash used to generate the
    ///        ECDSA signature that is the subject of the fraud claim. It is a
    ///        serialized subset of the transaction. The exact subset used as
    ///        the preimage depends on the transaction input the signature is
    ///        produced for. See BIP-143 for reference
    /// @param witness Flag indicating whether the preimage was produced for a
    ///        witness input. True for witness, false for non-witness input
    /// @dev Requirements:
    ///      - `walletPublicKey` and `sighash` calculated as `hash256(preimage)`
    ///        must identify an open fraud challenge
    ///      - the preimage must be a valid preimage of a transaction generated
    ///        according to the protocol rules and already proved in the Bridge
    ///      - before a defeat attempt is made the transaction that spends the
    ///        given UTXO must be proven in the Bridge
    function defeatFraudChallenge(
        bytes calldata walletPublicKey,
        bytes calldata preimage,
        bool witness
    ) external {
        self.defeatFraudChallenge(walletPublicKey, preimage, witness);
    }

    /// @notice Notifies about defeat timeout for the given fraud challenge.
    ///         Can be called only if there was a fraud challenge identified by
    ///         the provided `walletPublicKey` and `sighash` and it was not
    ///         defeated on time. The amount of time that needs to pass after
    ///         a fraud challenge is reported is indicated by the
    ///         `challengeDefeatTimeout`. After a successful fraud challenge
    ///         defeat timeout notification the fraud challenge is marked as
    ///         resolved, the stake of each operator is slashed, the ether
    ///         deposited is returned to the challenger and the challenger is
    ///         rewarded.
    /// @param walletPublicKey The public key of the wallet in the uncompressed
    ///        and unprefixed format (64 bytes)
    /// @param sighash The hash that was used to produce the ECDSA signature
    ///        that is the subject of the fraud claim. This hash is constructed
    ///        by applying double SHA-256 over a serialized subset of the
    ///        transaction. The exact subset used as hash preimage depends on
    ///        the transaction input the signature is produced for. See BIP-143
    ///        for reference
    /// @dev Requirements:
    ///      - `walletPublicKey`and `sighash` must identify an open fraud
    ///        challenge
    ///      - the amount of time indicated by `challengeDefeatTimeout` must
    ///        pass after the challenge was reported
    function notifyFraudChallengeDefeatTimeout(
        bytes calldata walletPublicKey,
        bytes32 sighash
    ) external {
        self.notifyFraudChallengeDefeatTimeout(walletPublicKey, sighash);
    }

    /// @notice Returns the fraud challenge identified by the given key built
    ///         as keccak256(walletPublicKey|sighash).
    function fraudChallenges(uint256 challengeKey)
        external
        view
        returns (Fraud.FraudChallenge memory)
    {
        return self.fraudChallenges[challengeKey];
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
        self.requestRedemption(
            walletPubKeyHash,
            mainUtxo,
            redeemerOutputScript,
            amount
        );
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
        self.submitRedemptionProof(
            redemptionTx,
            redemptionProof,
            mainUtxo,
            walletPubKeyHash
        );
    }

    /// @notice Notifies that there is a pending redemption request associated
    ///         with the given wallet, that has timed out. The redemption
    ///         request is identified by the key built as
    ///         `keccak256(walletPubKeyHash | redeemerOutputScript)`.
    ///         The results of calling this function: the pending redemptions
    ///         value for the wallet will be decreased by the requested amount
    ///         (minus treasury fee), the tokens taken from the redeemer on
    ///         redemption request will be returned to the redeemer, the request
    ///         will be moved from pending redemptions to timed-out redemptions.
    ///         If the state of the wallet is `Live` or `MovingFunds`, the
    ///         wallet operators will be slashed.
    ///         Additionally, if the state of wallet is `Live`, the wallet will
    ///         be closed or marked as `MovingFunds` (depending on the presence
    ///         or absence of the wallet's main UTXO) and the wallet will no
    ///         longer be marked as the active wallet (if it was marked as such).
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @param redeemerOutputScript  The redeemer's length-prefixed output
    ///        script (P2PKH, P2WPKH, P2SH or P2WSH)
    /// @dev Requirements:
    ///      - The redemption request identified by `walletPubKeyHash` and
    ///        `redeemerOutputScript` must exist
    ///      - The amount of time defined by `redemptionTimeout` must have
    ///        passed since the redemption was requested (the request must be
    ///        timed-out).
    function notifyRedemptionTimeout(
        bytes20 walletPubKeyHash,
        bytes calldata redeemerOutputScript
    ) external {
        self.notifyRedemptionTimeout(walletPubKeyHash, redeemerOutputScript);
    }

    function submitMovingFundsCommitment(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata walletMainUtxo,
        bytes20[] calldata targetWallets
    ) external {
        self.submitMovingFundsCommitment(
            wallets,
            walletPubKeyHash,
            walletMainUtxo,
            targetWallets
        );
    }

    /// @notice Used by the wallet to prove the BTC moving funds transaction
    ///         and to make the necessary state changes. Moving funds is only
    ///         accepted if it satisfies SPV proof.
    ///
    ///         The function validates the moving funds transaction structure
    ///         by checking if it actually spends the main UTXO of the declared
    ///         wallet and locks the value on the pre-committed target wallets
    ///         using a reasonable transaction fee. If all preconditions are
    ///         met, this functions closes the source wallet.
    ///
    ///         It is possible to prove the given moving funds transaction only
    ///         one time.
    /// @param movingFundsTx Bitcoin moving funds transaction data
    /// @param movingFundsProof Bitcoin moving funds proof data
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    ///        HASH160 over the compressed ECDSA public key) of the wallet
    ///        which performed the moving funds transaction
    /// @dev Requirements:
    ///      - `movingFundsTx` components must match the expected structure. See
    ///        `BitcoinTx.Info` docs for reference. Their values must exactly
    ///        correspond to appropriate Bitcoin transaction fields to produce
    ///        a provable transaction hash.
    ///      - The `movingFundsTx` should represent a Bitcoin transaction with
    ///        exactly 1 input that refers to the wallet's main UTXO. That
    ///        transaction should have 1..n outputs corresponding to the
    ///        pre-committed target wallets. Outputs must be ordered in the
    ///        same way as their corresponding target wallets are ordered
    ///        within the target wallets commitment.
    ///      - `movingFundsProof` components must match the expected structure.
    ///        See `BitcoinTx.Proof` docs for reference. The `bitcoinHeaders`
    ///        field must contain a valid number of block headers, not less
    ///        than the `txProofDifficultyFactor` contract constant.
    ///      - `mainUtxo` components must point to the recent main UTXO
    ///        of the given wallet, as currently known on the Ethereum chain.
    ///        Additionally, the recent main UTXO on Ethereum must be set.
    ///      - `walletPubKeyHash` must be connected with the main UTXO used
    ///        as transaction single input.
    ///      - The wallet that `walletPubKeyHash` points to must be in the
    ///        MovingFunds state.
    ///      - The target wallets commitment must be submitted by the wallet
    ///        that `walletPubKeyHash` points to.
    ///      - The total Bitcoin transaction fee must be lesser or equal
    ///        to `movingFundsTxMaxTotalFee` governable parameter.
    function submitMovingFundsProof(
        BitcoinTx.Info calldata movingFundsTx,
        BitcoinTx.Proof calldata movingFundsProof,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes20 walletPubKeyHash
    ) external {
        self.submitMovingFundsProof(
            movingFundsTx,
            movingFundsProof,
            mainUtxo,
            walletPubKeyHash
        );
    }

    /// @notice Returns the addresses of contracts Bridge is interacting with.
    /// @return bank Address of the Bank the Bridge belongs to.
    /// @return relay Address of the Bitcoin relay providing the current Bitcoin
    ///         network difficulty.
    function getContracts() external view returns (Bank bank, IRelay relay) {
        bank = self.bank;
        relay = self.relay;
    }

    /// @notice Address where the deposit treasury fees will be sent to.
    ///         Treasury takes part in the operators rewarding process.
    function treasury() external view returns (address treasury) {
        treasury = self.treasury;
    }

    /// @notice The number of confirmations on the Bitcoin chain required to
    ///         successfully evaluate an SPV proof.
    function txProofDifficultyFactor()
        external
        view
        returns (uint256 txProofDifficultyFactor)
    {
        txProofDifficultyFactor = self.txProofDifficultyFactor;
    }

    /// @notice Returns the current values of Bridge deposit parameters.
    /// @return depositDustThreshold The minimal amount that can be requested
    ///         to deposit. Value of this parameter must take into account the
    ///         value of `depositTreasuryFeeDivisor` and `depositTxMaxFee`
    ///         parameters in order to make requests that can incur the
    ///         treasury and transaction fee and still satisfy the depositor.
    /// @return depositTreasuryFeeDivisor Divisor used to compute the treasury
    ///         fee taken from each deposit and transferred to the treasury upon
    ///         sweep proof submission. That fee is computed as follows:
    ///         `treasuryFee = depositedAmount / depositTreasuryFeeDivisor`
    ///         For example, if the treasury fee needs to be 2% of each deposit,
    ///         the `depositTreasuryFeeDivisor` should be set to `50`
    ///         because `1/50 = 0.02 = 2%`.
    /// @return depositTxMaxFee Maximum amount of BTC transaction fee that can
    ///         be incurred by each swept deposit being part of the given sweep
    ///         transaction. If the maximum BTC transaction fee is exceeded,
    ///         such transaction is considered a fraud.
    function depositParameters()
        external
        view
        returns (
            uint64 depositDustThreshold,
            uint64 depositTreasuryFeeDivisor,
            uint64 depositTxMaxFee
        )
    {
        depositDustThreshold = self.depositDustThreshold;
        depositTreasuryFeeDivisor = self.depositTreasuryFeeDivisor;
        depositTxMaxFee = self.depositTxMaxFee;
    }

    /// @notice Returns the current values of Bridge redemption parameters.
    /// @return redemptionDustThreshold The minimal amount that can be requested
    ///         for redemption. Value of this parameter must take into account
    ///         the value of `redemptionTreasuryFeeDivisor` and `redemptionTxMaxFee`
    ///         parameters in order to make requests that can incur the
    ///         treasury and transaction fee and still satisfy the redeemer.
    /// @return redemptionTreasuryFeeDivisor Divisor used to compute the treasury
    ///         fee taken from each redemption request and transferred to the
    ///         treasury upon successful request finalization. That fee is
    ///         computed as follows:
    ///         `treasuryFee = requestedAmount / redemptionTreasuryFeeDivisor`
    ///         For example, if the treasury fee needs to be 2% of each
    ///         redemption request, the `redemptionTreasuryFeeDivisor` should
    ///         be set to `50` because `1/50 = 0.02 = 2%`.
    /// @return redemptionTxMaxFee Maximum amount of BTC transaction fee that
    ///         can be incurred by each redemption request being part of the
    ///         given redemption transaction. If the maximum BTC transaction
    ///         fee is exceeded, such transaction is considered a fraud.
    /// @return redemptionTimeout Time after which the redemption request can be
    ///         reported as timed out. It is counted from the moment when the
    ///         redemption request was created via `requestRedemption` call.
    ///         Reported  timed out requests are cancelled and locked TBTC is
    ///         returned to the redeemer in full amount.
    function redemptionParameters()
        external
        view
        returns (
            uint64 redemptionDustThreshold,
            uint64 redemptionTreasuryFeeDivisor,
            uint64 redemptionTxMaxFee,
            uint256 redemptionTimeout,
            address treasury,
            uint256 txProofDifficultyFactor
        )
    {
        redemptionDustThreshold = self.redemptionDustThreshold;
        redemptionTreasuryFeeDivisor = self.redemptionTreasuryFeeDivisor;
        redemptionTxMaxFee = self.redemptionTxMaxFee;
        redemptionTimeout = self.redemptionTimeout;
    }

    /// @notice Returns the current values of Bridge moving funds between
    ///         wallets parameters.
    /// @return movingFundsTxMaxTotalFee Maximum amount of the total BTC
    ///         transaction fee that is acceptable in a single moving funds
    ///         transaction. This is a _total_ max fee for the entire moving
    ///         funds transaction.
    function movingFundsParameters()
        external
        view
        returns (uint64 movingFundsTxMaxTotalFee)
    {
        // TODO: we will have more parameters here, for example moving funds timeout
        movingFundsTxMaxTotalFee = self.movingFundsTxMaxTotalFee;
    }

    /// @notice Returns the current values of Bridge fraud parameters.
    /// @return fraudSlashingAmount The amount slashed from each wallet member
    ///         for committing a fraud.
    /// @return fraudNotifierRewardMultiplier The percentage of the notifier
    ///         reward from the staking contract the notifier of a fraud
    ///         receives. The value is in the range [0, 100].
    /// @return fraudChallengeDefeatTimeout The amount of time the wallet has to
    ///         defeat a fraud challenge.
    /// @return fraudChallengeDepositAmount The amount of ETH in wei the party
    ///         challenging the wallet for fraud needs to deposit.
    function fraudParameters()
        external
        view
        returns (
            uint256 fraudSlashingAmount,
            uint256 fraudNotifierRewardMultiplier,
            uint256 fraudChallengeDefeatTimeout,
            uint256 fraudChallengeDepositAmount
        )
    {
        fraudSlashingAmount = self.fraudSlashingAmount;
        fraudNotifierRewardMultiplier = self.fraudNotifierRewardMultiplier;
        fraudChallengeDefeatTimeout = self.fraudChallengeDefeatTimeout;
        fraudChallengeDepositAmount = self.fraudChallengeDepositAmount;
    }

    /// @return walletCreationPeriod Determines how frequently a new wallet
    ///         creation can be requested. Value in seconds.
    /// @return walletMinBtcBalance The minimum BTC threshold in satoshi that is
    ///         used to decide about wallet creation or closing.
    /// @return walletMaxBtcBalance The maximum BTC threshold in satoshi that is
    ///         used to decide about wallet creation.
    /// @return walletMaxAge The maximum age of a wallet in seconds, after which
    ///         the wallet moving funds process can be requested.
    /// @return walletMaxBtcTransfer The maximum BTC transfer in satoshi than
    ///         can be sent  to a single target wallet during the moving
    ///         funds process.
    function walletParameters()
        external
        view
        returns (
            uint32 walletCreationPeriod,
            uint64 walletMinBtcBalance,
            uint64 walletMaxBtcBalance,
            uint32 walletMaxAge,
            uint64 walletMaxBtcTransfer
        )
    {
        walletCreationPeriod = self.walletCreationPeriod;
        walletMinBtcBalance = self.walletMinBtcBalance;
        walletMaxBtcBalance = self.walletMaxBtcBalance;
        walletMaxAge = self.walletMaxAge;
        walletMaxBtcTransfer = self.walletMaxBtcTransfer;
    }

    /// @notice Updates parameters of wallets.
    /// @param walletCreationPeriod New value of the wallet creation period in
    ///        seconds, determines how frequently a new wallet creation can be
    ///        requested
    /// @param walletMinBtcBalance New value of the wallet minimum BTC balance
    ///        in sathoshis, used to decide about wallet creation or closing
    /// @param walletMaxBtcBalance New value of the wallet maximum BTC balance
    ///        in sathoshis, used to decide about wallet creation
    /// @param walletMaxAge New value of the wallet maximum age in seconds,
    ///        indicates the maximum age of a wallet in seconds, after which
    ///        the wallet moving funds process can be requested
    /// @param walletMaxBtcTransfer New value of the wallet maximum BTC
    ///        transfer in satoshi, than can be sent  to a single target wallet
    //         during the moving funds process.
    /// @dev Requirements:
    ///      - Wallet minimum BTC balance must be greater than zero
    ///      - Wallet maximum BTC balance must be greater than the wallet
    ///        minimum BTC balance
    ///      - Wallet maximum BTC transfer must be greater than zero
    function updateWalletParameters(
        uint32 walletCreationPeriod,
        uint64 walletMinBtcBalance,
        uint64 walletMaxBtcBalance,
        uint32 walletMaxAge,
        uint64 walletMaxBtcTransfer
    ) external onlyOwner {
        self.updateWalletParameters(
            walletCreationPeriod,
            walletMinBtcBalance,
            walletMaxBtcBalance,
            walletMaxAge,
            walletMaxBtcTransfer
        );
    }

    /// @notice Indicates if the vault with the given address is trusted or not.
    ///         Depositors can route their revealed deposits only to trusted
    ///         vaults and have trusted vaults notified about new deposits as
    ///         soon as these deposits get swept. Vaults not trusted by the
    ///         Bridge can still be used by Bank balance owners on their own
    ///         responsibility - anyone can approve their Bank balance to any
    ///         address.
    function isVaultTrusted(address vault) external view returns (bool) {
        return self.isVaultTrusted[vault];
    }

    /// @notice Collection of all revealed deposits indexed by
    ///         keccak256(fundingTxHash | fundingOutputIndex).
    ///         The fundingTxHash is bytes32 (ordered as in Bitcoin internally)
    ///         and fundingOutputIndex an uint32. This mapping may contain valid
    ///         and invalid deposits and the wallet is responsible for
    ///         validating them before attempting to execute a sweep.
    function deposits(uint256 depositKey)
        external
        view
        returns (Deposit.DepositRequest memory)
    {
        return self.deposits[depositKey];
    }

    /// @notice Collection of main UTXOs that are honestly spent indexed by
    ///         keccak256(fundingTxHash | fundingOutputIndex). The fundingTxHash
    ///         is bytes32 (ordered as in Bitcoin internally) and
    ///         fundingOutputIndex an uint32. A main UTXO is considered honestly
    ///         spent if it was used as an input of a transaction that have been
    ///         proven in the Bridge.
    function spentMainUTXOs(uint256 utxoKey) external view returns (bool) {
        return self.spentMainUTXOs[utxoKey];
    }

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
    function pendingRedemptions(uint256 redemptionKey)
        external
        view
        returns (Redeem.RedemptionRequest memory)
    {
        return self.pendingRedemptions[redemptionKey];
    }

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
    function timedOutRedemptions(uint256 redemptionKey)
        external
        view
        returns (Redeem.RedemptionRequest memory)
    {
        return self.timedOutRedemptions[redemptionKey];
    }
}
