// SPDX-License-Identifier: GPL-3.0-only

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

pragma solidity 0.8.17;

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";

import "./BitcoinTx.sol";
import "./Bridge.sol";
import "./Deposit.sol";
import "./Redemption.sol";
import "./Wallets.sol";

/// @title Wallet proposal validator.
/// @notice This contract exposes several view functions allowing to validate
///         specific wallet action proposals. This contract is non-upgradeable
///         and does not have any write functions.
contract WalletProposalValidator {
    using BTCUtils for bytes;
    using BytesLib for bytes;

    /// @notice Helper structure representing a deposit sweep proposal.
    struct DepositSweepProposal {
        // 20-byte public key hash of the target wallet.
        bytes20 walletPubKeyHash;
        // Deposits that should be part of the sweep.
        DepositKey[] depositsKeys;
        // Proposed BTC fee for the entire transaction.
        uint256 sweepTxFee;
        // Array containing the reveal blocks of each deposit. This information
        // strongly facilitates the off-chain processing. Using those blocks,
        // wallet operators can quickly fetch corresponding Bridge.DepositRevealed
        // events carrying deposit data necessary to perform proposal validation.
        // This field is not explicitly validated within the validateDepositSweepProposal
        // function because if something is wrong here the off-chain wallet
        // operators will fail anyway as they won't be able to gather deposit
        // data necessary to perform the on-chain validation using the
        // validateDepositSweepProposal function.
        uint256[] depositsRevealBlocks;
    }

    /// @notice Helper structure representing a plain-text deposit key.
    ///         Each deposit can be identified by their 32-byte funding
    ///         transaction hash (Bitcoin internal byte order) an the funding
    ///         output index (0-based).
    /// @dev Do not confuse this structure with the deposit key used within the
    ///      Bridge contract to store deposits. Here we have the plain-text
    ///      components of the key while the Bridge uses a uint representation of
    ///      keccak256(fundingTxHash | fundingOutputIndex) for gas efficiency.
    struct DepositKey {
        bytes32 fundingTxHash;
        uint32 fundingOutputIndex;
    }

    /// @notice Helper structure holding deposit extra data required during
    ///         deposit sweep proposal validation. Basically, this structure
    ///         is a combination of BitcoinTx.Info and relevant parts of
    ///         Deposit.DepositRevealInfo.
    /// @dev These data can be pulled from respective `DepositRevealed` events
    ///      emitted by the `Bridge.revealDeposit` function. The `fundingTx`
    ///      field must be taken directly from the Bitcoin chain, using the
    ///      `DepositRevealed.fundingTxHash` as transaction identifier.
    struct DepositExtraInfo {
        BitcoinTx.Info fundingTx;
        bytes8 blindingFactor;
        bytes20 walletPubKeyHash;
        bytes20 refundPubKeyHash;
        bytes4 refundLocktime;
    }

    /// @notice Handle to the Bridge contract.
    Bridge public immutable bridge;

    /// @notice The minimum time that must elapse since the deposit reveal
    ///         before a deposit becomes eligible for a deposit sweep.
    ///
    ///         For example, if a deposit was revealed at 9 am and DEPOSIT_MIN_AGE
    ///         is 2 hours, the deposit is eligible for sweep after 11 am.
    ///
    /// @dev Forcing deposit minimum age ensures block finality for Ethereum.
    ///      In the happy path case, i.e. where the deposit is revealed immediately
    ///      after being broadcast on the Bitcoin network, the minimum age
    ///      check also ensures block finality for Bitcoin.
    uint32 public constant DEPOSIT_MIN_AGE = 2 hours;

    /// @notice Each deposit can be technically swept until it reaches its
    ///         refund timestamp after which it can be taken back by the depositor.
    ///         However, allowing the wallet to sweep deposits that are close
    ///         to their refund timestamp may cause a race between the wallet
    ///         and the depositor. In result, the wallet may sign an invalid
    ///         sweep transaction that aims to sweep an already refunded deposit.
    ///         Such tx signature may be used to create an undefeatable fraud
    ///         challenge against the wallet. In order to mitigate that problem,
    ///         this parameter determines a safety margin that puts the latest
    ///         moment a deposit can be swept far before the point after which
    ///         the deposit becomes refundable.
    ///
    ///         For example, if a deposit becomes refundable after 8 pm and
    ///         DEPOSIT_REFUND_SAFETY_MARGIN is 6 hours, the deposit is valid
    ///         for a sweep only before 2 pm.
    uint32 public constant DEPOSIT_REFUND_SAFETY_MARGIN = 24 hours;

    /// @notice The maximum count of deposits that can be swept within a
    ///         single sweep.
    uint16 public constant DEPOSIT_SWEEP_MAX_SIZE = 20;

    constructor(Bridge _bridge) {
        bridge = _bridge;
    }

    /// @notice View function encapsulating the main rules of a valid deposit
    ///         sweep proposal. This function is meant to facilitate the off-chain
    ///         validation of the incoming proposals. Thanks to it, most
    ///         of the work can be done using a single readonly contract call.
    ///         Worth noting, the validation done here is not exhaustive as some
    ///         conditions may not be verifiable within the on-chain function or
    ///         checking them may be easier on the off-chain side. For example,
    ///         this function does not check the SPV proofs and confirmations of
    ///         the deposit funding transactions as this would require an
    ///         integration with the difficulty relay that greatly increases
    ///         complexity. Instead of that, each off-chain wallet member is
    ///         supposed to do that check on their own.
    /// @param proposal The sweeping proposal to validate.
    /// @param depositsExtraInfo Deposits extra data required to perform the validation.
    /// @return True if the proposal is valid. Reverts otherwise.
    /// @dev Requirements:
    ///      - The target wallet must be in the Live state,
    ///      - The number of deposits included in the sweep must be in
    ///        the range [1, `DEPOSIT_SWEEP_MAX_SIZE`],
    ///      - The length of `depositsExtraInfo` array must be equal to the
    ///        length of `proposal.depositsKeys`, i.e. each deposit must
    ///        have exactly one set of corresponding extra data,
    ///      - The proposed sweep tx fee must be grater than zero,
    ///      - The proposed maximum per-deposit sweep tx fee must be lesser than
    ///        or equal the maximum fee allowed by the Bridge (`Bridge.depositTxMaxFee`),
    ///      - Each deposit must be revealed to the Bridge,
    ///      - Each deposit must be old enough, i.e. at least `DEPOSIT_MIN_AGE
    ///        elapsed since their reveal time,
    ///      - Each deposit must not be swept yet,
    ///      - Each deposit must have valid extra data (see `validateDepositExtraInfo`),
    ///      - Each deposit must have the refund safety margin preserved,
    ///      - Each deposit must be controlled by the same wallet,
    ///      - Each deposit must target the same vault,
    ///      - Each deposit must be unique.
    ///
    ///      The following off-chain validation must be performed as a bare minimum:
    ///      - Inputs used for the sweep transaction have enough Bitcoin confirmations,
    ///      - Deposits revealed to the Bridge have enough Ethereum confirmations.
    function validateDepositSweepProposal(
        DepositSweepProposal calldata proposal,
        DepositExtraInfo[] calldata depositsExtraInfo
    ) external view returns (bool) {
        require(
            bridge.wallets(proposal.walletPubKeyHash).state ==
                Wallets.WalletState.Live,
            "Wallet is not in Live state"
        );

        require(proposal.depositsKeys.length > 0, "Sweep below the min size");

        require(
            proposal.depositsKeys.length <= DEPOSIT_SWEEP_MAX_SIZE,
            "Sweep exceeds the max size"
        );

        require(
            proposal.depositsKeys.length == depositsExtraInfo.length,
            "Each deposit key must have matching extra data"
        );

        validateSweepTxFee(proposal.sweepTxFee, proposal.depositsKeys.length);

        address proposalVault = address(0);

        uint256[] memory processedDepositKeys = new uint256[](
            proposal.depositsKeys.length
        );

        for (uint256 i = 0; i < proposal.depositsKeys.length; i++) {
            DepositKey memory depositKey = proposal.depositsKeys[i];
            DepositExtraInfo memory depositExtraInfo = depositsExtraInfo[i];

            uint256 depositKeyUint = uint256(
                keccak256(
                    abi.encodePacked(
                        depositKey.fundingTxHash,
                        depositKey.fundingOutputIndex
                    )
                )
            );

            // slither-disable-next-line calls-loop
            Deposit.DepositRequest memory depositRequest = bridge.deposits(
                depositKeyUint
            );

            require(depositRequest.revealedAt != 0, "Deposit not revealed");

            require(
                /* solhint-disable-next-line not-rely-on-time */
                block.timestamp > depositRequest.revealedAt + DEPOSIT_MIN_AGE,
                "Deposit min age not achieved yet"
            );

            require(depositRequest.sweptAt == 0, "Deposit already swept");

            validateDepositExtraInfo(
                depositKey,
                depositRequest.depositor,
                depositExtraInfo
            );

            uint32 depositRefundableTimestamp = BTCUtils.reverseUint32(
                uint32(depositExtraInfo.refundLocktime)
            );
            require(
                /* solhint-disable-next-line not-rely-on-time */
                block.timestamp <
                    depositRefundableTimestamp - DEPOSIT_REFUND_SAFETY_MARGIN,
                "Deposit refund safety margin is not preserved"
            );

            require(
                depositExtraInfo.walletPubKeyHash == proposal.walletPubKeyHash,
                "Deposit controlled by different wallet"
            );

            // Make sure all deposits target the same vault by using the
            // vault of the first deposit as a reference.
            if (i == 0) {
                proposalVault = depositRequest.vault;
            }
            require(
                depositRequest.vault == proposalVault,
                "Deposit targets different vault"
            );

            // Make sure there are no duplicates in the deposits list.
            for (uint256 j = 0; j < i; j++) {
                require(
                    processedDepositKeys[j] != depositKeyUint,
                    "Duplicated deposit"
                );
            }

            processedDepositKeys[i] = depositKeyUint;
        }

        return true;
    }

    /// @notice Validates the sweep tx fee by checking if the part of the fee
    ///         incurred by each deposit does not exceed the maximum value
    ///         allowed by the Bridge. This function is heavily based on
    ///         `DepositSweep.depositSweepTxFeeDistribution` function.
    /// @param sweepTxFee The sweep transaction fee.
    /// @param depositsCount Count of the deposits swept by the sweep transaction.
    /// @dev Requirements:
    ///      - The sweep tx fee must be grater than zero,
    ///      - The maximum per-deposit sweep tx fee must be lesser than or equal
    ///        the maximum fee allowed by the Bridge (`Bridge.depositTxMaxFee`).
    function validateSweepTxFee(uint256 sweepTxFee, uint256 depositsCount)
        internal
        view
    {
        require(sweepTxFee > 0, "Proposed transaction fee cannot be zero");

        // Compute the indivisible remainder that remains after dividing the
        // sweep transaction fee over all deposits evenly.
        uint256 depositTxFeeRemainder = sweepTxFee % depositsCount;
        // Compute the transaction fee per deposit by dividing the sweep
        // transaction fee (reduced by the remainder) by the number of deposits.
        uint256 depositTxFee = (sweepTxFee - depositTxFeeRemainder) /
            depositsCount;

        (, , uint64 depositTxMaxFee, ) = bridge.depositParameters();

        // The transaction fee is incurred by each deposit evenly except for the last
        // deposit that has the indivisible remainder additionally incurred.
        // See `DepositSweep.submitDepositSweepProof`.
        // We must make sure the highest value of the deposit transaction fee does
        // not exceed the maximum value limited by the governable parameter.
        require(
            depositTxFee + depositTxFeeRemainder <= depositTxMaxFee,
            "Proposed transaction fee is too high"
        );
    }

    /// @notice Validates the extra data for the given deposit. This function
    ///         is heavily based on `Deposit.revealDeposit` function.
    /// @param depositKey Key of the given deposit.
    /// @param depositor Depositor that revealed the deposit.
    /// @param depositExtraInfo Extra data being subject of the validation.
    /// @dev Requirements:
    ///      - The transaction hash computed using `depositExtraInfo.fundingTx`
    ///        must match the `depositKey.fundingTxHash`. This requirement
    ///        ensures the funding transaction data provided in the extra
    ///        data container actually represent the funding transaction of
    ///        the given deposit.
    ///      - The P2(W)SH script inferred from `depositExtraInfo` is actually
    ///        used to lock funds by the `depositKey.fundingOutputIndex` output
    ///        of the `depositExtraInfo.fundingTx` transaction. This requirement
    ///        ensures the reveal data provided in the extra data container
    ///        actually matches the given deposit.
    function validateDepositExtraInfo(
        DepositKey memory depositKey,
        address depositor,
        DepositExtraInfo memory depositExtraInfo
    ) internal view {
        bytes32 depositExtraFundingTxHash = abi
            .encodePacked(
                depositExtraInfo.fundingTx.version,
                depositExtraInfo.fundingTx.inputVector,
                depositExtraInfo.fundingTx.outputVector,
                depositExtraInfo.fundingTx.locktime
            )
            .hash256View();

        // Make sure the funding tx provided as part of deposit extra data
        // actually matches the deposit referred by the given deposit key.
        if (depositKey.fundingTxHash != depositExtraFundingTxHash) {
            revert("Extra info funding tx hash does not match");
        }

        bytes memory expectedScript = abi.encodePacked(
            hex"14", // Byte length of depositor Ethereum address.
            depositor,
            hex"75", // OP_DROP
            hex"08", // Byte length of blinding factor value.
            depositExtraInfo.blindingFactor,
            hex"75", // OP_DROP
            hex"76", // OP_DUP
            hex"a9", // OP_HASH160
            hex"14", // Byte length of a compressed Bitcoin public key hash.
            depositExtraInfo.walletPubKeyHash,
            hex"87", // OP_EQUAL
            hex"63", // OP_IF
            hex"ac", // OP_CHECKSIG
            hex"67", // OP_ELSE
            hex"76", // OP_DUP
            hex"a9", // OP_HASH160
            hex"14", // Byte length of a compressed Bitcoin public key hash.
            depositExtraInfo.refundPubKeyHash,
            hex"88", // OP_EQUALVERIFY
            hex"04", // Byte length of refund locktime value.
            depositExtraInfo.refundLocktime,
            hex"b1", // OP_CHECKLOCKTIMEVERIFY
            hex"75", // OP_DROP
            hex"ac", // OP_CHECKSIG
            hex"68" // OP_ENDIF
        );

        bytes memory fundingOutput = depositExtraInfo
            .fundingTx
            .outputVector
            .extractOutputAtIndex(depositKey.fundingOutputIndex);
        bytes memory fundingOutputHash = fundingOutput.extractHash();

        // Path that checks the deposit extra data validity in case the
        // referred deposit is a P2SH.
        if (
            // slither-disable-next-line calls-loop
            fundingOutputHash.length == 20 &&
            fundingOutputHash.slice20(0) == expectedScript.hash160View()
        ) {
            return;
        }

        // Path that checks the deposit extra data validity in case the
        // referred deposit is a P2WSH.
        if (
            fundingOutputHash.length == 32 &&
            fundingOutputHash.toBytes32() == sha256(expectedScript)
        ) {
            return;
        }

        revert("Extra info funding output script does not match");
    }
}
