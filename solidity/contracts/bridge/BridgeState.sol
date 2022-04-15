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
        /// @notice Handle to the Bitcoin relay.
        IRelay relay;
        /// TODO: Revisit whether it should be governable or not.
        /// @notice Address where the redemptions treasury fees will be sent to.
        ///         Treasury takes part in the operators rewarding process.
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
        /// @notice Collection of main UTXOs that are honestly spent indexed by
        ///         keccak256(fundingTxHash | fundingOutputIndex). The fundingTxHash
        ///         is bytes32 (ordered as in Bitcoin internally) and
        ///         fundingOutputIndex an uint32. A main UTXO is considered honestly
        ///         spent if it was used as an input of a transaction that have been
        ///         proven in the Bridge.
        mapping(uint256 => bool) spentMainUTXOs;
    }

    /// @notice Determines the current Bitcoin SPV proof difficulty context.
    /// @return proofDifficulty Bitcoin proof difficulty context.
    function proofDifficultyContext(Storage storage self)
        internal
        view
        returns (BitcoinTx.ProofDifficulty memory proofDifficulty)
    {
        proofDifficulty.currentEpochDifficulty = self
            .relay
            .getCurrentEpochDifficulty();
        proofDifficulty.previousEpochDifficulty = self
            .relay
            .getPrevEpochDifficulty();
        proofDifficulty.difficultyFactor = self.txProofDifficultyFactor;

        return proofDifficulty;
    }
}
