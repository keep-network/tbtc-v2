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

import {IWalletRegistry as EcdsaWalletRegistry} from "@keep-network/ecdsa/contracts/api/IWalletRegistry.sol";

import "./IRelay.sol";
import "./Deposit.sol";
import "./Redemption.sol";
import "./Fraud.sol";
import "./Wallets.sol";

import "../bank/Bank.sol";

library BridgeState {
    // TODO: Make parameters governable
    struct Storage {
        // Address of the Bank the Bridge belongs to.
        Bank bank;
        // Bitcoin relay providing the current Bitcoin network difficulty.
        IRelay relay;
        // ECDSA Wallet Registry contract handle.
        EcdsaWalletRegistry ecdsaWalletRegistry;
        // The number of confirmations on the Bitcoin chain required to
        // successfully evaluate an SPV proof.
        uint256 txProofDifficultyFactor;
        // Address where the deposit and redemption treasury fees will be sent
        // to. Treasury takes part in the operators rewarding process.
        address treasury;
        // The minimal amount that can be requested to deposit.
        // Value of this parameter must take into account the value of
        // `depositTreasuryFeeDivisor` and `depositTxMaxFee` parameters in order
        // to make requests that can incur the treasury and transaction fee and
        // still satisfy the depositor.
        uint64 depositDustThreshold;
        // Divisor used to compute the treasury fee taken from each deposit and
        // transferred to the treasury upon sweep proof submission. That fee is
        // computed as follows:
        // `treasuryFee = depositedAmount / depositTreasuryFeeDivisor`
        // For example, if the treasury fee needs to be 2% of each deposit,
        // the `depositTreasuryFeeDivisor` should be set to `50` because
        // `1/50 = 0.02 = 2%`.
        uint64 depositTreasuryFeeDivisor;
        // Maximum amount of BTC transaction fee that can be incurred by each
        // swept deposit being part of the given sweep transaction. If the
        // maximum BTC transaction fee is exceeded, such transaction is
        // considered a fraud.
        //
        // This is a per-deposit input max fee for the sweep transaction.
        uint64 depositTxMaxFee;
        // Collection of all revealed deposits indexed by
        // `keccak256(fundingTxHash | fundingOutputIndex)`.
        // The `fundingTxHash` is `bytes32` (ordered as in Bitcoin internally)
        // and `fundingOutputIndex` an `uint32`. This mapping may contain valid
        // and invalid deposits and the wallet is responsible for validating
        // them before attempting to execute a sweep.
        mapping(uint256 => Deposit.DepositRequest) deposits;
        // Indicates if the vault with the given address is trusted or not.
        // Depositors can route their revealed deposits only to trusted vaults
        // and have trusted vaults notified about new deposits as soon as these
        // deposits get swept. Vaults not trusted by the Bridge can still be
        // used by Bank balance owners on their own responsibility - anyone can
        // approve their Bank balance to any address.
        mapping(address => bool) isVaultTrusted;
        // Maximum amount of the total BTC transaction fee that is acceptable in
        // a single moving funds transaction.
        //
        // This is a TOTAL max fee for the moving funds transaction. Note
        // that `depositTxMaxFee` is per single deposit and `redemptionTxMaxFee`
        // if per single redemption. `movingFundsTxMaxTotalFee` is a total
        // fee for the entire transaction.
        uint64 movingFundsTxMaxTotalFee;
        // Time after which the moving funds process can be reported as
        // timed out. It is counted from the moment when the wallet
        // was requested to move their funds and switched to the MovingFunds
        // state. Value in seconds.
        uint32 movingFundsTimeout;
        // The minimal satoshi amount that makes sense to be transferred during
        // the moving funds process. Moving funds wallets having their BTC
        // balance below that value can begin closing immediately as
        // transferring such a low value may not be possible due to
        // BTC network fees.
        uint64 movingFundsDustThreshold;
        // The minimal amount that can be requested for redemption.
        // Value of this parameter must take into account the value of
        // `redemptionTreasuryFeeDivisor` and `redemptionTxMaxFee`
        // parameters in order to make requests that can incur the
        // treasury and transaction fee and still satisfy the redeemer.
        uint64 redemptionDustThreshold;
        // Divisor used to compute the treasury fee taken from each
        // redemption request and transferred to the treasury upon
        // successful request finalization. That fee is computed as follows:
        // `treasuryFee = requestedAmount / redemptionTreasuryFeeDivisor`
        // For example, if the treasury fee needs to be 2% of each
        // redemption request, the `redemptionTreasuryFeeDivisor` should
        // be set to `50` because `1/50 = 0.02 = 2%`.
        uint64 redemptionTreasuryFeeDivisor;
        // Maximum amount of BTC transaction fee that can be incurred by
        // each redemption request being part of the given redemption
        // transaction. If the maximum BTC transaction fee is exceeded, such
        // transaction is considered a fraud.
        //
        // This is a per-redemption output max fee for the redemption
        // transaction.
        uint64 redemptionTxMaxFee;
        // Time after which the redemption request can be reported as
        // timed out. It is counted from the moment when the redemption
        // request was created via `requestRedemption` call. Reported
        // timed out requests are cancelled and locked TBTC is returned
        // to the redeemer in full amount.
        uint256 redemptionTimeout;
        // Collection of all pending redemption requests indexed by
        // redemption key built as
        // `keccak256(walletPubKeyHash | redeemerOutputScript)`.
        // The `walletPubKeyHash` is the 20-byte wallet's public key hash
        // (computed using Bitcoin HASH160 over the compressed ECDSA
        // public key) and `redeemerOutputScript` is a Bitcoin script
        // (P2PKH, P2WPKH, P2SH or P2WSH) that will be used to lock
        // redeemed BTC as requested by the redeemer. Requests are added
        // to this mapping by the `requestRedemption` method (duplicates
        // not allowed) and are removed by one of the following methods:
        // - `submitRedemptionProof` in case the request was handled
        //    successfully
        // - `notifyRedemptionTimeout` in case the request was reported
        //    to be timed out
        mapping(uint256 => Redemption.RedemptionRequest) pendingRedemptions;
        // Collection of all timed out redemptions requests indexed by
        // redemption key built as
        // `keccak256(walletPubKeyHash | redeemerOutputScript)`. The
        // `walletPubKeyHash` is the 20-byte wallet's public key hash
        // (computed using Bitcoin HASH160 over the compressed ECDSA
        // public key) and `redeemerOutputScript` is the Bitcoin script
        // (P2PKH, P2WPKH, P2SH or P2WSH) that is involved in the timed
        // out request. Timed out requests are stored in this mapping to
        // avoid slashing the wallets multiple times for the same timeout.
        // Only one method can add to this mapping:
        // - `notifyRedemptionTimeout` which puts the redemption key to this
        //    mapping basing on a timed out request stored previously in
        //    `pendingRedemptions` mapping.
        mapping(uint256 => Redemption.RedemptionRequest) timedOutRedemptions;
        // The amount of stake slashed from each member of a wallet for a fraud.
        uint256 fraudSlashingAmount;
        // The percentage of the notifier reward from the staking contract
        // the notifier of a fraud receives. The value is in the range [0, 100].
        uint256 fraudNotifierRewardMultiplier;
        // The amount of time the wallet has to defeat a fraud challenge.
        uint256 fraudChallengeDefeatTimeout;
        // The amount of ETH in wei the party challenging the wallet for fraud
        // needs to deposit.
        uint256 fraudChallengeDepositAmount;
        // Collection of all submitted fraud challenges indexed by challenge
        // key built as `keccak256(walletPublicKey|sighash)`.
        mapping(uint256 => Fraud.FraudChallenge) fraudChallenges;
        // Collection of main UTXOs that are honestly spent indexed by
        // `keccak256(fundingTxHash | fundingOutputIndex)`. The `fundingTxHash`
        // is `bytes32` (ordered as in Bitcoin internally) and
        // `fundingOutputIndex` an `uint32`. A main UTXO is considered honestly
        // spent if it was used as an input of a transaction that have been
        // proven in the Bridge.
        mapping(uint256 => bool) spentMainUTXOs;
        // Determines how frequently a new wallet creation can be requested.
        // Value in seconds.
        uint32 walletCreationPeriod;
        // The minimum BTC threshold in satoshi that is used to decide about
        // wallet creation or closing.
        uint64 walletMinBtcBalance;
        // The maximum BTC threshold in satoshi that is used to decide about
        // wallet creation.
        uint64 walletMaxBtcBalance;
        // The maximum age of a wallet in seconds, after which the wallet
        // moving funds process can be requested.
        uint32 walletMaxAge;
        // 20-byte wallet public key hash being reference to the currently
        // active wallet. Can be unset to the zero value under certain
        // circumstances.
        bytes20 activeWalletPubKeyHash;
        // The current number of wallets in the Live state.
        uint32 liveWalletsCount;
        // The maximum BTC amount in satoshi than can be transferred to a single
        // target wallet during the moving funds process.
        uint64 walletMaxBtcTransfer;
        // Determines the length of the wallet closing period, i.e. the period
        // when the wallet remains in the Closing state and can be subject
        // of deposit fraud challenges. This value is in seconds and should be
        // greater than the deposit refund time plus some time margin.
        uint32 walletClosingPeriod;
        // Maps the 20-byte wallet public key hash (computed using Bitcoin
        // HASH160 over the compressed ECDSA public key) to the basic wallet
        // information like state and pending redemptions value.
        mapping(bytes20 => Wallets.Wallet) registeredWallets;
    }

    event DepositParametersUpdated(
        uint64 depositDustThreshold,
        uint64 depositTreasuryFeeDivisor,
        uint64 depositTxMaxFee
    );

    event RedemptionParametersUpdated(
        uint64 redemptionDustThreshold,
        uint64 redemptionTreasuryFeeDivisor,
        uint64 redemptionTxMaxFee,
        uint256 redemptionTimeout
    );

    event MovingFundsParametersUpdated(
        uint64 movingFundsTxMaxTotalFee,
        uint32 movingFundsTimeout,
        uint64 movingFundsDustThreshold
    );

    event WalletParametersUpdated(
        uint32 walletCreationPeriod,
        uint64 walletMinBtcBalance,
        uint64 walletMaxBtcBalance,
        uint32 walletMaxAge,
        uint64 walletMaxBtcTransfer,
        uint32 walletClosingPeriod
    );

    event FraudParametersUpdated(
        uint256 fraudSlashingAmount,
        uint256 fraudNotifierRewardMultiplier,
        uint256 fraudChallengeDefeatTimeout,
        uint256 fraudChallengeDepositAmount
    );

    /// @notice Updates parameters of deposits.
    /// @param _depositDustThreshold New value of the deposit dust threshold in
    ///        satoshis. It is the minimal amount that can be requested to
    ////       deposit. Value of this parameter must take into account the value
    ///        of `depositTreasuryFeeDivisor` and `depositTxMaxFee` parameters
    ///        in order to make requests that can incur the treasury and
    ///        transaction fee and still satisfy the depositor
    /// @param _depositTreasuryFeeDivisor New value of the treasury fee divisor.
    ///        It is the divisor used to compute the treasury fee taken from
    ///        each deposit and transferred to the treasury upon sweep proof
    ///        submission. That fee is computed as follows:
    ///        `treasuryFee = depositedAmount / depositTreasuryFeeDivisor`
    ///        For example, if the treasury fee needs to be 2% of each deposit,
    ///        the `depositTreasuryFeeDivisor` should be set to `50`
    ///        because `1/50 = 0.02 = 2%`
    /// @param _depositTxMaxFee New value of the deposit tx max fee in satoshis.
    ///        It is the maximum amount of BTC transaction fee that can
    ///        be incurred by each swept deposit being part of the given sweep
    ///        transaction. If the maximum BTC transaction fee is exceeded,
    ///        such transaction is considered a fraud
    /// @dev Requirements:
    ///      - Deposit dust threshold must be greater than zero
    ///      - Deposit treasury fee divisor must be greater than zero
    ///      - Deposit transaction max fee must be greater than zero
    function updateDepositParameters(
        Storage storage self,
        uint64 _depositDustThreshold,
        uint64 _depositTreasuryFeeDivisor,
        uint64 _depositTxMaxFee
    ) internal {
        require(
            _depositDustThreshold > 0,
            "Deposit dust threshold must be greater than zero"
        );

        require(
            _depositTreasuryFeeDivisor > 0,
            "Deposit treasury fee divisor must be greater than zero"
        );

        require(
            _depositTxMaxFee > 0,
            "Deposit transaction max fee must be greater than zero"
        );

        self.depositDustThreshold = _depositDustThreshold;
        self.depositTreasuryFeeDivisor = _depositTreasuryFeeDivisor;
        self.depositTxMaxFee = _depositTxMaxFee;

        emit DepositParametersUpdated(
            _depositDustThreshold,
            _depositTreasuryFeeDivisor,
            _depositTxMaxFee
        );
    }

    /// @notice Updates parameters of redemptions.
    /// @param _redemptionDustThreshold New value of the redemption dust
    ///        threshold in satoshis. It is the minimal amount that can be
    ///        requested for redemption. Value of this parameter must take into
    ///        account the value of `redemptionTreasuryFeeDivisor` and
    ///        `redemptionTxMaxFee` parameters in order to make requests that
    ///        can incur the treasury and transaction fee and still satisfy the
    ///        redeemer.
    /// @param _redemptionTreasuryFeeDivisor New value of the redemption
    ///        treasury fee divisor. It is the divisor used to compute the
    ///        treasury fee taken from each redemption request and transferred
    ///        to the treasury upon successful request finalization. That fee is
    ///        computed as follows:
    ///        `treasuryFee = requestedAmount / redemptionTreasuryFeeDivisor`
    ///        For example, if the treasury fee needs to be 2% of each
    ///        redemption request, the `redemptionTreasuryFeeDivisor` should
    ///        be set to `50` because `1/50 = 0.02 = 2%`.
    /// @param _redemptionTxMaxFee New value of the redemption transaction max
    ///        fee in satoshis. It is the maximum amount of BTC transaction fee
    ///        that can be incurred by each redemption request being part of the
    ///        given redemption transaction. If the maximum BTC transaction fee
    ///        is exceeded, such transaction is considered a fraud.
    ///        This is a per-redemption output max fee for the redemption
    ///        transaction.
    /// @param _redemptionTimeout New value of the redemption timeout in seconds.
    ///        It is the time after which the redemption request can be reported
    ///        as timed out. It is counted from the moment when the redemption
    ///        request was created via `requestRedemption` call. Reported  timed
    ///        out requests are cancelled and locked TBTC is returned to the
    ///        redeemer in full amount.
    /// @dev Requirements:
    ///      - Redemption dust threshold must be greater than zero
    ///      - Redemption treasury fee divisor must be greater than zero
    ///      - Redemption transaction max fee must be greater than zero
    ///      - Redemption timeout must be greater than zero
    function updateRedemptionParameters(
        Storage storage self,
        uint64 _redemptionDustThreshold,
        uint64 _redemptionTreasuryFeeDivisor,
        uint64 _redemptionTxMaxFee,
        uint256 _redemptionTimeout
    ) internal {
        require(
            _redemptionDustThreshold > 0,
            "Redemption dust threshold must be greater than zero"
        );

        require(
            _redemptionTreasuryFeeDivisor > 0,
            "Redemption treasury fee divisor must be greater than zero"
        );

        require(
            _redemptionTxMaxFee > 0,
            "Redemption transaction max fee must be greater than zero"
        );

        require(
            _redemptionTimeout > 0,
            "Redemption timeout must be greater than zero"
        );

        self.redemptionDustThreshold = _redemptionDustThreshold;
        self.redemptionTreasuryFeeDivisor = _redemptionTreasuryFeeDivisor;
        self.redemptionTxMaxFee = _redemptionTxMaxFee;
        self.redemptionTimeout = _redemptionTimeout;

        emit RedemptionParametersUpdated(
            _redemptionDustThreshold,
            _redemptionTreasuryFeeDivisor,
            _redemptionTxMaxFee,
            _redemptionTimeout
        );
    }

    /// @notice Updates parameters of moving funds.
    /// @param _movingFundsTxMaxTotalFee New value of the moving funds transaction
    ///        max total fee in satoshis. It is the maximum amount of the total
    ///        BTC transaction fee that is acceptable in a single moving funds
    ///        transaction. This is a _total_ max fee for the entire moving
    ///        funds transaction.
    /// @param _movingFundsTimeout New value of the moving funds timeout in
    ///        seconds. It is the time after which the moving funds process can
    ///        be reported as timed out. It is counted from the moment when the
    ///        wallet was requested to move their funds and switched to the
    ///        MovingFunds state.
    /// @param _movingFundsDustThreshold New value of the moving funds dust
    ///        threshold. It is the minimal satoshi amount that makes sense to
    //         be transferred during the moving funds process. Moving funds
    //         wallets having their BTC balance below that value can begin
    //         closing immediately as transferring such a low value may not be
    //         possible due to BTC network fees.
    /// @dev Requirements:
    ///      - Moving funds transaction max total fee must be greater than zero
    ///      - Moving funds timeout must be greater than zero
    ///      - Moving funds dust threshold must be greater than zero
    function updateMovingFundsParameters(
        Storage storage self,
        uint64 _movingFundsTxMaxTotalFee,
        uint32 _movingFundsTimeout,
        uint64 _movingFundsDustThreshold
    ) internal {
        require(
            _movingFundsTxMaxTotalFee > 0,
            "Moving funds transaction max total fee must be greater than zero"
        );

        require(
            _movingFundsTimeout > 0,
            "Moving funds timeout must be greater than zero"
        );

        require(
            _movingFundsDustThreshold > 0,
            "Moving funds dust threshold must be greater than zero"
        );

        self.movingFundsTxMaxTotalFee = _movingFundsTxMaxTotalFee;
        self.movingFundsTimeout = _movingFundsTimeout;
        self.movingFundsDustThreshold = _movingFundsDustThreshold;

        emit MovingFundsParametersUpdated(
            _movingFundsTxMaxTotalFee,
            _movingFundsTimeout,
            _movingFundsDustThreshold
        );
    }

    /// @notice Updates parameters of wallets.
    /// @param _walletCreationPeriod New value of the wallet creation period in
    ///        seconds, determines how frequently a new wallet creation can be
    ///        requested
    /// @param _walletMinBtcBalance New value of the wallet minimum BTC balance
    ///        in satoshi, used to decide about wallet creation or closing
    /// @param _walletMaxBtcBalance New value of the wallet maximum BTC balance
    ///        in satoshi, used to decide about wallet creation
    /// @param _walletMaxAge New value of the wallet maximum age in seconds,
    ///        indicates the maximum age of a wallet in seconds, after which
    ///        the wallet moving funds process can be requested
    /// @param _walletMaxBtcTransfer New value of the wallet maximum BTC transfer
    ///        in satoshi, determines the maximum amount that can be transferred
    ///        to a single target wallet during the moving funds process
    /// @param _walletClosingPeriod New value of the wallet closing period in
    ///        seconds, determines the length of the wallet closing period,
    //         i.e. the period when the wallet remains in the Closing state
    //         and can be subject of deposit fraud challenges
    /// @dev Requirements:
    ///      - Wallet minimum BTC balance must be greater than zero
    ///      - Wallet maximum BTC balance must be greater than the wallet
    ///        minimum BTC balance
    ///      - Wallet maximum BTC transfer must be greater than zero
    ///      - Wallet closing period must be greater than zero
    function updateWalletParameters(
        Storage storage self,
        uint32 _walletCreationPeriod,
        uint64 _walletMinBtcBalance,
        uint64 _walletMaxBtcBalance,
        uint32 _walletMaxAge,
        uint64 _walletMaxBtcTransfer,
        uint32 _walletClosingPeriod
    ) internal {
        require(
            _walletMinBtcBalance > 0,
            "Wallet minimum BTC balance must be greater than zero"
        );
        require(
            _walletMaxBtcBalance > _walletMinBtcBalance,
            "Wallet maximum BTC balance must be greater than the minimum"
        );
        require(
            _walletMaxBtcTransfer > 0,
            "Wallet maximum BTC transfer must be greater than zero"
        );
        require(
            _walletClosingPeriod > 0,
            "Wallet closing period must be greater than zero"
        );

        self.walletCreationPeriod = _walletCreationPeriod;
        self.walletMinBtcBalance = _walletMinBtcBalance;
        self.walletMaxBtcBalance = _walletMaxBtcBalance;
        self.walletMaxAge = _walletMaxAge;
        self.walletMaxBtcTransfer = _walletMaxBtcTransfer;
        self.walletClosingPeriod = _walletClosingPeriod;

        emit WalletParametersUpdated(
            _walletCreationPeriod,
            _walletMinBtcBalance,
            _walletMaxBtcBalance,
            _walletMaxAge,
            _walletMaxBtcTransfer,
            _walletClosingPeriod
        );
    }

    /// @notice Updates parameters related to frauds.
    /// @param _fraudSlashingAmount New value of the fraud slashing amount in T,
    ///        it is the amount slashed from each wallet member for committing
    ///        a fraud
    /// @param _fraudNotifierRewardMultiplier New value of the fraud notifier
    ///        reward multiplier as percentage, it determines the percentage of
    ///        the notifier reward from the staking contact the notifier of
    ///        a fraud receives. The value must be in the range [0, 100]
    /// @param _fraudChallengeDefeatTimeout New value of the challenge defeat
    ///        timeout in seconds, it is the amount of time the wallet has to
    ///        defeat a fraud challenge. The value must be greater than zero
    /// @param _fraudChallengeDepositAmount New value of the fraud challenge
    ///        deposit amount in wei, it is the amount of ETH the party
    ///        challenging the wallet for fraud needs to deposit
    /// @dev Requirements:
    ///      - Fraud notifier reward multiplier must be in the range [0, 100]
    ///      - Fraud challenge defeat timeout must be greater than 0
    function updateFraudParameters(
        Storage storage self,
        uint256 _fraudSlashingAmount,
        uint256 _fraudNotifierRewardMultiplier,
        uint256 _fraudChallengeDefeatTimeout,
        uint256 _fraudChallengeDepositAmount
    ) internal {
        require(
            _fraudNotifierRewardMultiplier <= 100,
            "Fraud notifier reward multiplier must be in the range [0, 100]"
        );

        require(
            _fraudChallengeDefeatTimeout > 0,
            "Fraud challenge defeat timeout must be greater than zero"
        );

        self.fraudSlashingAmount = _fraudSlashingAmount;
        self.fraudNotifierRewardMultiplier = _fraudNotifierRewardMultiplier;
        self.fraudChallengeDefeatTimeout = _fraudChallengeDefeatTimeout;
        self.fraudChallengeDepositAmount = _fraudChallengeDepositAmount;

        emit FraudParametersUpdated(
            _fraudSlashingAmount,
            _fraudNotifierRewardMultiplier,
            _fraudChallengeDefeatTimeout,
            _fraudChallengeDepositAmount
        );
    }
}
