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

import "./IRelay.sol";
import "./Deposit.sol";
import "./Redeem.sol";

import "../bank/Bank.sol";

library BridgeState {
    struct Storage {
        /// @notice The number of confirmations on the Bitcoin chain required to
        ///         successfully evaluate an SPV proof.
        uint256 txProofDifficultyFactor;
        /// TODO: Revisit whether it should be governable or not.
        /// @notice Address of the Bank this Bridge belongs to.
        Bank bank;
        /// TODO: Make it governable.
        /// @notice Bitcoin relay providing the current Bitcoin network
        ///         difficulty.
        IRelay relay;
        /// TODO: Revisit whether it should be governable or not.
        /// @notice Address where the deposit and redemption treasury fees will
        ///         be sent to. Treasury takes part in the operators rewarding
        ///         process.
        address treasury;
        /// TODO: Make it governable.
        /// @notice The minimal amount that can be requested to deposit.
        ///         Value of this parameter must take into account the value of
        ///         `depositTreasuryFeeDivisor` and `depositTxMaxFee`
        ///         parameters in order to make requests that can incur the
        ///         treasury and transaction fee and still satisfy the depositor.
        uint64 depositDustThreshold;
        /// TODO: Make it governable.
        /// @notice Divisor used to compute the treasury fee taken from each
        ///         deposit and transferred to the treasury upon sweep proof
        ///         submission. That fee is computed as follows:
        ///         `treasuryFee = depositedAmount / depositTreasuryFeeDivisor`
        ///         For example, if the treasury fee needs to be 2% of each deposit,
        ///         the `depositTreasuryFeeDivisor` should be set to `50`
        ///         because `1/50 = 0.02 = 2%`.
        uint64 depositTreasuryFeeDivisor;
        /// TODO: Make it governable.
        /// @notice Maximum amount of BTC transaction fee that can be incurred by
        ///         each swept deposit being part of the given sweep
        ///         transaction. If the maximum BTC transaction fee is exceeded,
        ///         such transaction is considered a fraud.
        /// @dev This is a per-deposit input max fee for the sweep transaction.
        uint64 depositTxMaxFee;
        /// @notice Collection of all revealed deposits indexed by
        ///         keccak256(fundingTxHash | fundingOutputIndex).
        ///         The fundingTxHash is bytes32 (ordered as in Bitcoin internally)
        ///         and fundingOutputIndex an uint32. This mapping may contain valid
        ///         and invalid deposits and the wallet is responsible for
        ///         validating them before attempting to execute a sweep.
        mapping(uint256 => Deposit.Request) deposits;
        /// @notice Indicates if the vault with the given address is trusted or not.
        ///         Depositors can route their revealed deposits only to trusted
        ///         vaults and have trusted vaults notified about new deposits as
        ///         soon as these deposits get swept. Vaults not trusted by the
        ///         Bridge can still be used by Bank balance owners on their own
        ///         responsibility - anyone can approve their Bank balance to any
        ///         address.
        mapping(address => bool) isVaultTrusted;
        /// TODO: Make it governable.
        /// @notice The minimal amount that can be requested for redemption.
        ///         Value of this parameter must take into account the value of
        ///         `redemptionTreasuryFeeDivisor` and `redemptionTxMaxFee`
        ///         parameters in order to make requests that can incur the
        ///         treasury and transaction fee and still satisfy the redeemer.
        uint64 redemptionDustThreshold;
        /// TODO: Make it governable.
        /// @notice Divisor used to compute the treasury fee taken from each
        ///         redemption request and transferred to the treasury upon
        ///         successful request finalization. That fee is computed as follows:
        ///         `treasuryFee = requestedAmount / redemptionTreasuryFeeDivisor`
        ///         For example, if the treasury fee needs to be 2% of each
        ///         redemption request, the `redemptionTreasuryFeeDivisor` should
        ///         be set to `50` because `1/50 = 0.02 = 2%`.
        uint64 redemptionTreasuryFeeDivisor;
        /// TODO: Make it governable.
        /// @notice Maximum amount of BTC transaction fee that can be incurred by
        ///         each redemption request being part of the given redemption
        ///         transaction. If the maximum BTC transaction fee is exceeded, such
        ///         transaction is considered a fraud.
        /// @dev This is a per-redemption output max fee for the redemption transaction.
        uint64 redemptionTxMaxFee;
        /// TODO: Make it governable.
        /// @notice Time after which the redemption request can be reported as
        ///         timed out. It is counted from the moment when the redemption
        ///         request was created via `requestRedemption` call. Reported
        ///         timed out requests are cancelled and locked TBTC is returned
        ///         to the redeemer in full amount.
        uint256 redemptionTimeout;
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
        mapping(uint256 => Redeem.RedemptionRequest) pendingRedemptions;
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
        mapping(uint256 => Redeem.RedemptionRequest) timedOutRedemptions;
        /// @notice Collection of main UTXOs that are honestly spent indexed by
        ///         keccak256(fundingTxHash | fundingOutputIndex). The fundingTxHash
        ///         is bytes32 (ordered as in Bitcoin internally) and
        ///         fundingOutputIndex an uint32. A main UTXO is considered honestly
        ///         spent if it was used as an input of a transaction that have been
        ///         proven in the Bridge.
        mapping(uint256 => bool) spentMainUTXOs;
    }

    // TODO: Is it the right place for this function? Should we move it to Bridge?
    /// @notice Determines the current Bitcoin SPV proof difficulty context.
    /// @return proofDifficulty Bitcoin proof difficulty context.
    function proofDifficultyContext(Storage storage self)
        internal
        view
        returns (BitcoinTx.ProofDifficulty memory proofDifficulty)
    {
        IRelay relay = self.relay;
        proofDifficulty.currentEpochDifficulty = relay
            .getCurrentEpochDifficulty();
        proofDifficulty.previousEpochDifficulty = relay
            .getPrevEpochDifficulty();
        proofDifficulty.difficultyFactor = self.txProofDifficultyFactor;

        return proofDifficulty;
    }
}
