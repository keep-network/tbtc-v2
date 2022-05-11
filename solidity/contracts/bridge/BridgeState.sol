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
import "./MovingFunds.sol";

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
        // The minimal satoshi amount that makes sense to be transferred during
        // the moving funds process. Moving funds wallets having their BTC
        // balance below that value can begin closing immediately as
        // transferring such a low value may not be possible due to
        // BTC network fees. The value of this parameter must always be lower
        // than `redemptionDustThreshold` in order to prevent redemption requests
        // with values lower or equal to `movingFundsDustThreshold`.
        uint64 movingFundsDustThreshold;
        // Time after which the moving funds process can be reported as
        // timed out. It is counted from the moment when the wallet
        // was requested to move their funds and switched to the MovingFunds
        // state. Value in seconds.
        uint32 movingFundsTimeout;
        // The amount of stake slashed from each member of a wallet for a moving
        // funds timeout.
        uint96 movingFundsTimeoutSlashingAmount;
        // The percentage of the notifier reward from the staking contract
        // the notifier of a moving funds timeout receives. The value is in the
        // range [0, 100].
        uint256 movingFundsTimeoutNotifierRewardMultiplier;
        // Maximum amount of the total BTC transaction fee that is acceptable in
        // a single moved funds sweep transaction.
        //
        // This is a TOTAL max fee for the moved funds sweep transaction. Note
        // that `depositTxMaxFee` is per single deposit and `redemptionTxMaxFee`
        // if per single redemption. `movedFundsSweepTxMaxTotalFee` is a total
        // fee for the entire transaction.
        uint64 movedFundsSweepTxMaxTotalFee;
        // Time after which the moved funds sweep process can be reported as
        // timed out. It is counted from the moment when the recipient wallet
        // was requested to sweep the received funds. Value in seconds.
        uint32 movedFundsSweepTimeout;
        // The amount of stake slashed from each member of a wallet for a moved
        // funds sweep timeout.
        uint96 movedFundsSweepTimeoutSlashingAmount;
        // The percentage of the notifier reward from the staking contract
        // the notifier of a moved funds sweep timeout receives. The value is
        // in the range [0, 100].
        uint256 movedFundsSweepTimeoutNotifierRewardMultiplier;
        // Collection of all moved funds sweep requests indexed by
        // `keccak256(movingFundsTxHash | movingFundsOutputIndex)`.
        // The `movingFundsTxHash` is `bytes32` (ordered as in Bitcoin
        // internally) and `movingFundsOutputIndex` an `uint32`. Each entry
        // is actually an UTXO representing the moved funds and is supposed
        // to be swept with the current main UTXO of the recipient wallet.
        mapping(uint256 => MovingFunds.MovedFundsSweepRequest) movedFundsSweepRequests;
        // The minimal amount that can be requested for redemption.
        // Value of this parameter must take into account the value of
        // `redemptionTreasuryFeeDivisor` and `redemptionTxMaxFee`
        // parameters in order to make requests that can incur the
        // treasury and transaction fee and still satisfy the redeemer.
        // Additionally, the value of this parameter must always be greater
        // than `movingFundsDustThreshold` in order to prevent redemption
        // requests with values lower or equal to `movingFundsDustThreshold`.
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
        // The amount of stake slashed from each member of a wallet for a
        // redemption timeout.
        uint96 redemptionTimeoutSlashingAmount;
        // The percentage of the notifier reward from the staking contract
        // the notifier of a redemption timeout receives. The value is in the
        // range [0, 100].
        uint256 redemptionTimeoutNotifierRewardMultiplier;
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
        // The amount of ETH in wei the party challenging the wallet for fraud
        // needs to deposit.
        uint256 fraudChallengeDepositAmount;
        // The amount of time the wallet has to defeat a fraud challenge.
        uint256 fraudChallengeDefeatTimeout;
        // The amount of stake slashed from each member of a wallet for a fraud.
        uint96 fraudSlashingAmount;
        // The percentage of the notifier reward from the staking contract
        // the notifier of a fraud receives. The value is in the range [0, 100].
        uint256 fraudNotifierRewardMultiplier;
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
        // wallet creation. Specifically, we allow for the creation of a new
        // wallet if the active wallet is old enough and their amount of BTC
        // is greater than or equal this threshold.
        uint64 walletCreationMinBtcBalance;
        // The maximum BTC threshold in satoshi that is used to decide about
        // wallet creation. Specifically, we allow for the creation of a new
        // wallet if the active wallet's amount of BTC is greater than or equal
        // this threshold, regardless of the active wallet's age.
        uint64 walletCreationMaxBtcBalance;
        // The minimum BTC threshold in satoshi that is used to decide about
        // wallet closing. Specifically, we allow for the closure of the given
        // wallet if their amount of BTC is lesser than this threshold,
        // regardless of the wallet's age.
        uint64 walletClosureMinBtcBalance;
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
        uint256 redemptionTimeout,
        uint96 redemptionTimeoutSlashingAmount,
        uint256 redemptionTimeoutNotifierRewardMultiplier
    );

    event MovingFundsParametersUpdated(
        uint64 movingFundsTxMaxTotalFee,
        uint64 movingFundsDustThreshold,
        uint32 movingFundsTimeout,
        uint96 movingFundsTimeoutSlashingAmount,
        uint256 movingFundsTimeoutNotifierRewardMultiplier,
        uint64 movedFundsSweepTxMaxTotalFee,
        uint32 movedFundsSweepTimeout,
        uint96 movedFundsSweepTimeoutSlashingAmount,
        uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
    );

    event WalletParametersUpdated(
        uint32 walletCreationPeriod,
        uint64 walletCreationMinBtcBalance,
        uint64 walletCreationMaxBtcBalance,
        uint64 walletClosureMinBtcBalance,
        uint32 walletMaxAge,
        uint64 walletMaxBtcTransfer,
        uint32 walletClosingPeriod
    );

    event FraudParametersUpdated(
        uint256 fraudChallengeDepositAmount,
        uint256 fraudChallengeDefeatTimeout,
        uint96 fraudSlashingAmount,
        uint256 fraudNotifierRewardMultiplier
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
    /// @param _redemptionTimeoutSlashingAmount New value of the redemption
    ///        timeout slashing amount in T, it is the amount slashed from each
    ///        wallet member for redemption timeout
    /// @param _redemptionTimeoutNotifierRewardMultiplier New value of the
    ///        redemption timeout notifier reward multiplier as percentage,
    ///        it determines the percentage of the notifier reward from the
    ///        staking contact the notifier of a redemption timeout receives.
    ///        The value must be in the range [0, 100]
    /// @dev Requirements:
    ///      - Redemption dust threshold must be greater than moving funds dust
    ///        threshold
    ///      - Redemption treasury fee divisor must be greater than zero
    ///      - Redemption transaction max fee must be greater than zero
    ///      - Redemption timeout must be greater than zero
    ///      - Redemption timeout notifier reward multiplier must be in the
    ///        range [0, 100]
    function updateRedemptionParameters(
        Storage storage self,
        uint64 _redemptionDustThreshold,
        uint64 _redemptionTreasuryFeeDivisor,
        uint64 _redemptionTxMaxFee,
        uint256 _redemptionTimeout,
        uint96 _redemptionTimeoutSlashingAmount,
        uint256 _redemptionTimeoutNotifierRewardMultiplier
    ) internal {
        require(
            _redemptionDustThreshold > self.movingFundsDustThreshold,
            "Redemption dust threshold must be greater than moving funds dust threshold"
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

        require(
            _redemptionTimeoutNotifierRewardMultiplier <= 100,
            "Redemption timeout notifier reward multiplier must be in the range [0, 100]"
        );

        self.redemptionDustThreshold = _redemptionDustThreshold;
        self.redemptionTreasuryFeeDivisor = _redemptionTreasuryFeeDivisor;
        self.redemptionTxMaxFee = _redemptionTxMaxFee;
        self.redemptionTimeout = _redemptionTimeout;
        self.redemptionTimeoutSlashingAmount = _redemptionTimeoutSlashingAmount;
        self
            .redemptionTimeoutNotifierRewardMultiplier = _redemptionTimeoutNotifierRewardMultiplier;

        emit RedemptionParametersUpdated(
            _redemptionDustThreshold,
            _redemptionTreasuryFeeDivisor,
            _redemptionTxMaxFee,
            _redemptionTimeout,
            _redemptionTimeoutSlashingAmount,
            _redemptionTimeoutNotifierRewardMultiplier
        );
    }

    /// @notice Updates parameters of moving funds.
    /// @param _movingFundsTxMaxTotalFee New value of the moving funds transaction
    ///        max total fee in satoshis. It is the maximum amount of the total
    ///        BTC transaction fee that is acceptable in a single moving funds
    ///        transaction. This is a _total_ max fee for the entire moving
    ///        funds transaction.
    /// @param _movingFundsDustThreshold New value of the moving funds dust
    ///        threshold. It is the minimal satoshi amount that makes sense to
    //         be transferred during the moving funds process. Moving funds
    //         wallets having their BTC balance below that value can begin
    //         closing immediately as transferring such a low value may not be
    //         possible due to BTC network fees.
    /// @param _movingFundsTimeout New value of the moving funds timeout in
    ///        seconds. It is the time after which the moving funds process can
    ///        be reported as timed out. It is counted from the moment when the
    ///        wallet was requested to move their funds and switched to the
    ///        MovingFunds state.
    /// @param _movingFundsTimeoutSlashingAmount New value of the moving funds
    ///        timeout slashing amount in T, it is the amount slashed from each
    ///        wallet member for moving funds timeout
    /// @param _movingFundsTimeoutNotifierRewardMultiplier New value of the
    ///        moving funds timeout notifier reward multiplier as percentage,
    ///        it determines the percentage of the notifier reward from the
    ///        staking contact the notifier of a moving funds timeout receives.
    ///        The value must be in the range [0, 100]
    /// @param _movedFundsSweepTxMaxTotalFee New value of the moved funds sweep
    ///        transaction max total fee in satoshis. It is the maximum amount
    ///        of the total BTC transaction fee that is acceptable in a single
    ///        moved funds sweep transaction. This is a _total_ max fee for the
    ///        entire moved funds sweep transaction.
    /// @param _movedFundsSweepTimeout New value of the moved funds sweep
    ///        timeout in seconds. It is the time after which the moved funds
    ///        sweep process can be reported as timed out. It is counted from
    ///        the moment when the wallet was requested to sweep the received
    ///        funds.
    /// @param _movedFundsSweepTimeoutSlashingAmount New value of the moved
    ///        funds sweep timeout slashing amount in T, it is the amount
    ///        slashed from each wallet member for moved funds sweep timeout
    /// @param _movedFundsSweepTimeoutNotifierRewardMultiplier New value of
    ///        the moved funds sweep timeout notifier reward multiplier as
    ///        percentage, it determines the percentage of the notifier reward
    ///        from the staking contact the notifier of a moved funds sweep
    ///        timeout receives. The value must be in the range [0, 100]
    /// @dev Requirements:
    ///      - Moving funds transaction max total fee must be greater than zero
    ///      - Moving funds dust threshold must be greater than zero and lower
    ///        than the redemption dust threshold
    ///      - Moving funds timeout must be greater than zero
    ///      - Moving funds timeout notifier reward multiplier must be in the
    ///        range [0, 100]
    ///      - Moved funds sweep transaction max total fee must be greater than zero
    ///      - Moved funds sweep timeout must be greater than zero
    ///      - Moved funds sweep timeout notifier reward multiplier must be in the
    ///        range [0, 100]
    function updateMovingFundsParameters(
        Storage storage self,
        uint64 _movingFundsTxMaxTotalFee,
        uint64 _movingFundsDustThreshold,
        uint32 _movingFundsTimeout,
        uint96 _movingFundsTimeoutSlashingAmount,
        uint256 _movingFundsTimeoutNotifierRewardMultiplier,
        uint64 _movedFundsSweepTxMaxTotalFee,
        uint32 _movedFundsSweepTimeout,
        uint96 _movedFundsSweepTimeoutSlashingAmount,
        uint256 _movedFundsSweepTimeoutNotifierRewardMultiplier
    ) internal {
        require(
            _movingFundsTxMaxTotalFee > 0,
            "Moving funds transaction max total fee must be greater than zero"
        );

        require(
            _movingFundsDustThreshold > 0 &&
                _movingFundsDustThreshold < self.redemptionDustThreshold,
            "Moving funds dust threshold must be greater than zero and lower than redemption dust threshold"
        );

        require(
            _movingFundsTimeout > 0,
            "Moving funds timeout must be greater than zero"
        );

        require(
            _movingFundsTimeoutNotifierRewardMultiplier <= 100,
            "Moving funds timeout notifier reward multiplier must be in the range [0, 100]"
        );

        require(
            _movedFundsSweepTxMaxTotalFee > 0,
            "Moved funds sweep transaction max total fee must be greater than zero"
        );

        require(
            _movedFundsSweepTimeout > 0,
            "Moved funds sweep timeout must be greater than zero"
        );

        require(
            _movedFundsSweepTimeoutNotifierRewardMultiplier <= 100,
            "Moved funds sweep timeout notifier reward multiplier must be in the range [0, 100]"
        );

        self.movingFundsTxMaxTotalFee = _movingFundsTxMaxTotalFee;
        self.movingFundsDustThreshold = _movingFundsDustThreshold;
        self.movingFundsTimeout = _movingFundsTimeout;
        self
            .movingFundsTimeoutSlashingAmount = _movingFundsTimeoutSlashingAmount;
        self
            .movingFundsTimeoutNotifierRewardMultiplier = _movingFundsTimeoutNotifierRewardMultiplier;
        self.movedFundsSweepTxMaxTotalFee = _movedFundsSweepTxMaxTotalFee;
        self.movedFundsSweepTimeout = _movedFundsSweepTimeout;
        self
            .movedFundsSweepTimeoutSlashingAmount = _movedFundsSweepTimeoutSlashingAmount;
        self
            .movedFundsSweepTimeoutNotifierRewardMultiplier = _movedFundsSweepTimeoutNotifierRewardMultiplier;

        emit MovingFundsParametersUpdated(
            _movingFundsTxMaxTotalFee,
            _movingFundsDustThreshold,
            _movingFundsTimeout,
            _movingFundsTimeoutSlashingAmount,
            _movingFundsTimeoutNotifierRewardMultiplier,
            _movedFundsSweepTxMaxTotalFee,
            _movedFundsSweepTimeout,
            _movedFundsSweepTimeoutSlashingAmount,
            _movedFundsSweepTimeoutNotifierRewardMultiplier
        );
    }

    /// @notice Updates parameters of wallets.
    /// @param _walletCreationPeriod New value of the wallet creation period in
    ///        seconds, determines how frequently a new wallet creation can be
    ///        requested
    /// @param _walletCreationMinBtcBalance New value of the wallet minimum BTC
    ///        balance in satoshi, used to decide about wallet creation
    /// @param _walletCreationMaxBtcBalance New value of the wallet maximum BTC
    ///        balance in satoshi, used to decide about wallet creation
    /// @param _walletClosureMinBtcBalance New value of the wallet minimum BTC
    ///        balance in satoshi, used to decide about wallet closure
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
        uint64 _walletCreationMinBtcBalance,
        uint64 _walletCreationMaxBtcBalance,
        uint64 _walletClosureMinBtcBalance,
        uint32 _walletMaxAge,
        uint64 _walletMaxBtcTransfer,
        uint32 _walletClosingPeriod
    ) internal {
        require(
            _walletCreationMaxBtcBalance > _walletCreationMinBtcBalance,
            "Wallet creation maximum BTC balance must be greater than the creation minimum BTC balance"
        );
        require(
            _walletClosureMinBtcBalance > 0,
            "Wallet closure minimum BTC balance must be greater than zero"
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
        self.walletCreationMinBtcBalance = _walletCreationMinBtcBalance;
        self.walletCreationMaxBtcBalance = _walletCreationMaxBtcBalance;
        self.walletClosureMinBtcBalance = _walletClosureMinBtcBalance;
        self.walletMaxAge = _walletMaxAge;
        self.walletMaxBtcTransfer = _walletMaxBtcTransfer;
        self.walletClosingPeriod = _walletClosingPeriod;

        emit WalletParametersUpdated(
            _walletCreationPeriod,
            _walletCreationMinBtcBalance,
            _walletCreationMaxBtcBalance,
            _walletClosureMinBtcBalance,
            _walletMaxAge,
            _walletMaxBtcTransfer,
            _walletClosingPeriod
        );
    }

    /// @notice Updates parameters related to frauds.
    /// @param _fraudChallengeDepositAmount New value of the fraud challenge
    ///        deposit amount in wei, it is the amount of ETH the party
    ///        challenging the wallet for fraud needs to deposit
    /// @param _fraudChallengeDefeatTimeout New value of the challenge defeat
    ///        timeout in seconds, it is the amount of time the wallet has to
    ///        defeat a fraud challenge. The value must be greater than zero
    /// @param _fraudSlashingAmount New value of the fraud slashing amount in T,
    ///        it is the amount slashed from each wallet member for committing
    ///        a fraud
    /// @param _fraudNotifierRewardMultiplier New value of the fraud notifier
    ///        reward multiplier as percentage, it determines the percentage of
    ///        the notifier reward from the staking contact the notifier of
    ///        a fraud receives. The value must be in the range [0, 100]
    /// @dev Requirements:
    ///      - Fraud challenge defeat timeout must be greater than 0
    ///      - Fraud notifier reward multiplier must be in the range [0, 100]
    function updateFraudParameters(
        Storage storage self,
        uint256 _fraudChallengeDepositAmount,
        uint256 _fraudChallengeDefeatTimeout,
        uint96 _fraudSlashingAmount,
        uint256 _fraudNotifierRewardMultiplier
    ) internal {
        require(
            _fraudChallengeDefeatTimeout > 0,
            "Fraud challenge defeat timeout must be greater than zero"
        );

        require(
            _fraudNotifierRewardMultiplier <= 100,
            "Fraud notifier reward multiplier must be in the range [0, 100]"
        );

        self.fraudChallengeDepositAmount = _fraudChallengeDepositAmount;
        self.fraudChallengeDefeatTimeout = _fraudChallengeDefeatTimeout;
        self.fraudSlashingAmount = _fraudSlashingAmount;
        self.fraudNotifierRewardMultiplier = _fraudNotifierRewardMultiplier;

        emit FraudParametersUpdated(
            _fraudChallengeDepositAmount,
            _fraudChallengeDefeatTimeout,
            _fraudSlashingAmount,
            _fraudNotifierRewardMultiplier
        );
    }
}
