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
        // state.
        uint32 movingFundsTimeout;
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
        // Maps the 20-byte wallet public key hash (computed using Bitcoin
        // HASH160 over the compressed ECDSA public key) to the basic wallet
        // information like state and pending redemptions value.
        mapping(bytes20 => Wallets.Wallet) registeredWallets;
    }

    event WalletParametersUpdated(
        uint32 walletCreationPeriod,
        uint64 walletMinBtcBalance,
        uint64 walletMaxBtcBalance,
        uint32 walletMaxAge,
        uint64 walletMaxBtcTransfer
    );

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
    //         to a single target wallet during the moving funds process
    /// @dev Requirements:
    ///      - Wallet minimum BTC balance must be greater than zero
    ///      - Wallet maximum BTC balance must be greater than the wallet
    ///        minimum BTC balance
    ///      - Wallet maximum BTC transfer must be greater than zero
    function updateWalletParameters(
        Storage storage self,
        uint32 _walletCreationPeriod,
        uint64 _walletMinBtcBalance,
        uint64 _walletMaxBtcBalance,
        uint32 _walletMaxAge,
        uint64 _walletMaxBtcTransfer
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

        self.walletCreationPeriod = _walletCreationPeriod;
        self.walletMinBtcBalance = _walletMinBtcBalance;
        self.walletMaxBtcBalance = _walletMaxBtcBalance;
        self.walletMaxAge = _walletMaxAge;
        self.walletMaxBtcTransfer = _walletMaxBtcTransfer;

        emit WalletParametersUpdated(
            _walletCreationPeriod,
            _walletMinBtcBalance,
            _walletMaxBtcBalance,
            _walletMaxAge,
            _walletMaxBtcTransfer
        );
    }
}
