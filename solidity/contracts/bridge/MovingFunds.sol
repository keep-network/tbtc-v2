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

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";

import "./BitcoinTx.sol";
import "./BridgeState.sol";
import "./Redemption.sol";
import "./Wallets.sol";

/// @title Moving Bridge wallet funds
/// @notice The library handles the logic for moving Bitcoin between Bridge
///         wallets.
/// @dev A wallet that failed a heartbeat, did not process requested redemption
///      on time, or qualifies to be closed, begins the procedure of moving
///      funds to other wallets in the Bridge. The wallet needs to commit to
///      which other Live wallets it is moving the funds to and then, provide an
///      SPV proof of moving funds to the previously committed wallets.
///      Once the proof is submitted, all target wallets are supposed to
///      merge the received UTXOs with their own main UTXOs in order to
///      update their BTC balances.
library MovingFunds {
    using BridgeState for BridgeState.Storage;
    using Wallets for BridgeState.Storage;
    using BitcoinTx for BridgeState.Storage;

    using BTCUtils for bytes;
    using BytesLib for bytes;

    /// @notice Represents temporary information needed during the processing
    ///         of the moving funds Bitcoin transaction outputs. This structure
    ///         is an internal one and should not be exported outside of the
    ///         moving funds transaction processing code.
    /// @dev Allows to mitigate "stack too deep" errors on EVM.
    struct MovingFundsTxOutputsProcessingInfo {
        // 32-byte hash of the moving funds Bitcoin transaction.
        bytes32 movingFundsTxHash;
        // Output vector of the moving funds Bitcoin transaction. It is
        // assumed the vector's structure is valid so it must be validated
        // using e.g. `BTCUtils.validateVout` function before being used
        // during the processing.
        bytes movingFundsTxOutputVector;
    }

    /// @notice Represents a moved funds merge request.
    struct MovedFundsMergeRequest {
        // 20-byte public key hash of the wallet supposed to merge the UTXO
        // representing the received funds with their own main UTXO
        bytes20 walletPubKeyHash;
        // UNIX timestamp the request was created at.
        uint32 createdAt;
        // UNIX timestamp the funds were merged at.
        uint32 mergedAt;
    }

    event MovingFundsCommitmentSubmitted(
        bytes20 walletPubKeyHash,
        bytes20[] targetWallets,
        address submitter
    );

    event MovingFundsCompleted(
        bytes20 walletPubKeyHash,
        bytes32 movingFundsTxHash
    );

    event MovingFundsTimedOut(bytes20 walletPubKeyHash);

    event MovingFundsBelowDustReported(bytes20 walletPubKeyHash);

    /// @notice Submits the moving funds target wallets commitment.
    ///         Once all requirements are met, that function registers the
    ///         target wallets commitment and opens the way for moving funds
    ///         proof submission.
    /// @param walletPubKeyHash 20-byte public key hash of the source wallet
    /// @param walletMainUtxo Data of the source wallet's main UTXO, as
    ///        currently known on the Ethereum chain
    /// @param walletMembersIDs Identifiers of the source wallet signing group
    ///        members
    /// @param walletMemberIndex Position of the caller in the source wallet
    ///        signing group members list
    /// @param targetWallets List of 20-byte public key hashes of the target
    ///        wallets that the source wallet commits to move the funds to
    /// @dev Requirements:
    ///      - The source wallet must be in the MovingFunds state
    ///      - The source wallet must not have pending redemption requests
    ///      - The source wallet must not have submitted its commitment already
    ///      - The expression `keccak256(abi.encode(walletMembersIDs))` must
    ///        be exactly the same as the hash stored under `membersIdsHash`
    ///        for the given source wallet in the ECDSA registry. Those IDs are
    ///        not directly stored in the contract for gas efficiency purposes
    ///        but they can be read from appropriate `DkgResultSubmitted`
    ///        and `DkgResultApproved` events.
    ///      - The `walletMemberIndex` must be in range [1, walletMembersIDs.length]
    ///      - The caller must be the member of the source wallet signing group
    ///        at the position indicated by `walletMemberIndex` parameter
    ///      - The `walletMainUtxo` components must point to the recent main
    ///        UTXO of the source wallet, as currently known on the Ethereum
    ///        chain.
    ///      - Source wallet BTC balance must be greater than zero
    ///      - At least one Live wallet must exist in the system
    ///      - Submitted target wallets count must match the expected count
    ///        `N = min(liveWalletsCount, ceil(walletBtcBalance / walletMaxBtcTransfer))`
    ///        where `N > 0`
    ///      - Each target wallet must be not equal to the source wallet
    ///      - Each target wallet must follow the expected order i.e. all
    ///        target wallets 20-byte public key hashes represented as numbers
    ///        must form a strictly increasing sequence without duplicates.
    ///      - Each target wallet must be in Live state
    function submitMovingFundsCommitment(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata walletMainUtxo,
        uint32[] calldata walletMembersIDs,
        uint256 walletMemberIndex,
        bytes20[] calldata targetWallets
    ) external {
        Wallets.Wallet storage wallet = self.registeredWallets[
            walletPubKeyHash
        ];

        require(
            wallet.state == Wallets.WalletState.MovingFunds,
            "Source wallet must be in MovingFunds state"
        );

        require(
            wallet.pendingRedemptionsValue == 0,
            "Source wallet must handle all pending redemptions first"
        );

        require(
            wallet.movingFundsTargetWalletsCommitmentHash == bytes32(0),
            "Target wallets commitment already submitted"
        );

        require(
            self.ecdsaWalletRegistry.isWalletMember(
                wallet.ecdsaWalletID,
                walletMembersIDs,
                msg.sender,
                walletMemberIndex
            ),
            "Caller is not a member of the source wallet"
        );

        uint64 walletBtcBalance = self.getWalletBtcBalance(
            walletPubKeyHash,
            walletMainUtxo
        );

        require(walletBtcBalance > 0, "Wallet BTC balance is zero");

        uint256 expectedTargetWalletsCount = Math.min(
            self.liveWalletsCount,
            Math.ceilDiv(walletBtcBalance, self.walletMaxBtcTransfer)
        );

        // This requirement fails only when `liveWalletsCount` is zero. In
        // that case, the system cannot accept the commitment and must provide
        // new wallets first.
        //
        // TODO: Expose separate function to reset the moving funds timeout
        //       if no Live wallets exist in the system.
        require(expectedTargetWalletsCount > 0, "No target wallets available");

        require(
            targetWallets.length == expectedTargetWalletsCount,
            "Submitted target wallets count is other than expected"
        );

        uint160 lastProcessedTargetWallet = 0;

        for (uint256 i = 0; i < targetWallets.length; i++) {
            bytes20 targetWallet = targetWallets[i];

            require(
                targetWallet != walletPubKeyHash,
                "Submitted target wallet cannot be equal to the source wallet"
            );

            require(
                uint160(targetWallet) > lastProcessedTargetWallet,
                "Submitted target wallet breaks the expected order"
            );

            require(
                self.registeredWallets[targetWallet].state ==
                    Wallets.WalletState.Live,
                "Submitted target wallet must be in Live state"
            );

            lastProcessedTargetWallet = uint160(targetWallet);
        }

        wallet.movingFundsTargetWalletsCommitmentHash = keccak256(
            abi.encodePacked(targetWallets)
        );

        emit MovingFundsCommitmentSubmitted(
            walletPubKeyHash,
            targetWallets,
            msg.sender
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
        BridgeState.Storage storage self,
        BitcoinTx.Info calldata movingFundsTx,
        BitcoinTx.Proof calldata movingFundsProof,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes20 walletPubKeyHash
    ) external {
        // The actual transaction proof is performed here. After that point, we
        // can assume the transaction happened on Bitcoin chain and has
        // a sufficient number of confirmations as determined by
        // `txProofDifficultyFactor` constant.
        bytes32 movingFundsTxHash = self.validateProof(
            movingFundsTx,
            movingFundsProof
        );

        // Process the moving funds transaction input. Specifically, check if
        // it refers to the expected wallet's main UTXO.
        OutboundTx.processWalletOutboundTxInput(
            self,
            movingFundsTx.inputVector,
            mainUtxo,
            walletPubKeyHash
        );

        (
            bytes32 targetWalletsHash,
            uint256 outputsTotalValue
        ) = processMovingFundsTxOutputs(
                self,
                MovingFundsTxOutputsProcessingInfo(
                    movingFundsTxHash,
                    movingFundsTx.outputVector
                )
            );

        require(
            mainUtxo.txOutputValue - outputsTotalValue <=
                self.movingFundsTxMaxTotalFee,
            "Transaction fee is too high"
        );

        self.notifyWalletFundsMoved(walletPubKeyHash, targetWalletsHash);
        // slither-disable-next-line reentrancy-events
        emit MovingFundsCompleted(walletPubKeyHash, movingFundsTxHash);
    }

    /// @notice Processes the moving funds Bitcoin transaction output vector
    ///         and extracts information required for further processing.
    /// @param processInfo Processing info containing the moving funds tx
    ///        hash and output vector.
    /// @return targetWalletsHash keccak256 hash over the list of actual
    ///         target wallets used in the transaction.
    /// @return outputsTotalValue Sum of all outputs values.
    /// @dev Requirements:
    ///      - The `movingFundsTxOutputVector` must be parseable, i.e. must
    ///        be validated by the caller as stated in their parameter doc.
    ///      - Each output must refer to a 20-byte public key hash.
    ///      - The total outputs value must be evenly divided over all outputs.
    function processMovingFundsTxOutputs(
        BridgeState.Storage storage self,
        MovingFundsTxOutputsProcessingInfo memory processInfo
    ) internal returns (bytes32 targetWalletsHash, uint256 outputsTotalValue) {
        // Determining the total number of Bitcoin transaction outputs in
        // the same way as for number of inputs. See `BitcoinTx.outputVector`
        // docs for more details.
        (
            uint256 outputsCompactSizeUintLength,
            uint256 outputsCount
        ) = processInfo.movingFundsTxOutputVector.parseVarInt();

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

        bytes20[] memory targetWallets = new bytes20[](outputsCount);
        uint64[] memory outputsValues = new uint64[](outputsCount);

        // Outputs processing loop.
        for (uint256 i = 0; i < outputsCount; i++) {
            uint256 outputLength = processInfo
                .movingFundsTxOutputVector
                .determineOutputLengthAt(outputStartingIndex);

            bytes memory output = processInfo.movingFundsTxOutputVector.slice(
                outputStartingIndex,
                outputLength
            );

            bytes20 targetWalletPubKeyHash = self.processPubKeyHashTxOutput(output);

            // Add the wallet public key hash to the list that will be used
            // to build the result list hash. There is no need to check if
            // given output is a change here because the actual target wallet
            // list must be exactly the same as the pre-committed target wallet
            // list which is guaranteed to be valid.
            targetWallets[i] = targetWalletPubKeyHash;

            // Extract the value from given output.
            outputsValues[i] = output.extractValue();
            outputsTotalValue += outputsValues[i];

            // Register a moved funds merge request that must be handled
            // by the target wallet. The target wallet must merge the
            // received funds with their own main UTXO in order to update
            // their BTC balance. Worth noting there is no need to check
            // if the merge request already exists in the system because
            // the moving funds wallet is moved to the Closing state after
            // submitting the moving funds proof so there is no possibility
            // to submit the proof again and register the merge request twice.
            self.movedFundsMergeRequests[
                uint256(
                    keccak256(
                        abi.encodePacked(processInfo.movingFundsTxHash, i)
                    )
                )
            ] = MovedFundsMergeRequest(
                targetWalletPubKeyHash,
                /* solhint-disable-next-line not-rely-on-time */
                uint32(block.timestamp),
                0
            );

            // Make the `outputStartingIndex` pointing to the next output by
            // increasing it by current output's length.
            outputStartingIndex += outputLength;
        }

        // Compute the indivisible remainder that remains after dividing the
        // outputs total value over all outputs evenly.
        uint256 outputsTotalValueRemainder = outputsTotalValue % outputsCount;
        // Compute the minimum allowed output value by dividing the outputs
        // total value (reduced by the remainder) by the number of outputs.
        uint256 minOutputValue = (outputsTotalValue -
            outputsTotalValueRemainder) / outputsCount;
        // Maximum possible value is the minimum value with the remainder included.
        uint256 maxOutputValue = minOutputValue + outputsTotalValueRemainder;

        for (uint256 i = 0; i < outputsCount; i++) {
            require(
                minOutputValue <= outputsValues[i] &&
                    outputsValues[i] <= maxOutputValue,
                "Transaction amount is not distributed evenly"
            );
        }

        targetWalletsHash = keccak256(abi.encodePacked(targetWallets));

        return (targetWalletsHash, outputsTotalValue);
    }

    /// @notice Notifies about a timed out moving funds process. Terminates
    ///         the wallet and slashes signing group members as a result.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @dev Requirements:
    ///      - The wallet must be in the MovingFunds state
    ///      - The moving funds timeout must be actually exceeded
    function notifyMovingFundsTimeout(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash
    ) external {
        Wallets.Wallet storage wallet = self.registeredWallets[
            walletPubKeyHash
        ];

        require(
            wallet.state == Wallets.WalletState.MovingFunds,
            "ECDSA wallet must be in MovingFunds state"
        );

        require(
            /* solhint-disable-next-line not-rely-on-time */
            block.timestamp >
                wallet.movingFundsRequestedAt + self.movingFundsTimeout,
            "Moving funds has not timed out yet"
        );

        self.terminateWallet(walletPubKeyHash);

        // TODO: Perform slashing of wallet operators, reward the notifier
        //       using seized amount, and add unit tests for that.

        // slither-disable-next-line reentrancy-events
        emit MovingFundsTimedOut(walletPubKeyHash);
    }

    /// @notice Notifies about a moving funds wallet whose BTC balance is
    ///         below the moving funds dust threshold. Ends the moving funds
    ///         process and begins wallet closing immediately.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known
    ///        on the Ethereum chain.
    /// @dev Requirements:
    ///      - The wallet must be in the MovingFunds state
    ///      - The `mainUtxo` components must point to the recent main UTXO
    ///        of the given wallet, as currently known on the Ethereum chain.
    ///        If the wallet has no main UTXO, this parameter can be empty as it
    ///        is ignored.
    ///      - The wallet BTC balance must be below the moving funds threshold
    function notifyMovingFundsBelowDust(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata mainUtxo
    ) external {
        Wallets.Wallet storage wallet = self.registeredWallets[
            walletPubKeyHash
        ];

        require(
            wallet.state == Wallets.WalletState.MovingFunds,
            "ECDSA wallet must be in MovingFunds state"
        );

        uint64 walletBtcBalance = self.getWalletBtcBalance(
            walletPubKeyHash,
            mainUtxo
        );

        require(
            walletBtcBalance < self.movingFundsDustThreshold,
            "Wallet BTC balance must be below the moving funds dust threshold"
        );

        self.beginWalletClosing(walletPubKeyHash);

        // slither-disable-next-line reentrancy-events
        emit MovingFundsBelowDustReported(walletPubKeyHash);
    }
}
