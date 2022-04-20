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

import "./BitcoinTx.sol";
import "./BridgeState.sol";
import "./Wallets.sol";

import "../bank/Bank.sol";

/// @title Bridge deposit sweep
/// @notice The library handles the logic for sweeping transactions revealed to
///         the Bridge
/// @dev Bridge active wallet periodically signs a transaction that unlocks all
///      of the valid, revealed deposits above the dust threshold, combines them
///      into a single UTXO with the existing main wallet UTXO, and relocks
///      those transactions without a 30-day refund clause to the same wallet.
///      This has two main effects: it consolidates the UTXO set and it disables
///      the refund. Balances of depositors in the Bank are increased when the
///      SPV sweep proof is submitted to the Bridge.
library Sweep {
    using BridgeState for BridgeState.Storage;
    using BitcoinTx for BridgeState.Storage;

    using BTCUtils for bytes;

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

    event DepositsSwept(bytes20 walletPubKeyHash, bytes32 sweepTxHash);

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
        BridgeState.Storage storage self,
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
        bytes32 sweepTxHash = self.validateProof(sweepTx, sweepProof);

        // Process sweep transaction output and extract its target wallet
        // public key hash and value.
        (
            bytes20 walletPubKeyHash,
            uint64 sweepTxOutputValue
        ) = processSweepTxOutput(sweepTx.outputVector);

        (
            Wallets.Wallet storage wallet,
            BitcoinTx.UTXO memory resolvedMainUtxo
        ) = resolveSweepingWallet(self, walletPubKeyHash, mainUtxo);

        // Process sweep transaction inputs and extract all information needed
        // to perform deposit bookkeeping.
        SweepTxInputsInfo memory inputsInfo = processSweepTxInputs(
            self,
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
            depositTxFee + depositTxFeeRemainder <= self.depositTxMaxFee,
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
        self.bank.increaseBalances(
            inputsInfo.depositors,
            inputsInfo.depositedAmounts
        );
        // Pass the treasury fee to the treasury address.
        self.bank.increaseBalance(self.treasury, totalTreasuryFee);

        // TODO: Handle deposits having `vault` set.
    }

    /// @notice Resolves sweeping wallet based on the provided wallet public key
    ///         hash. Validates the wallet state and current main UTXO, as
    ///         currently known on the Ethereum chain.
    /// @param walletPubKeyHash public key hash of the wallet proving the sweep
    ///        Bitcoin transaction.
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain. If no main UTXO exists for the given wallet,
    ///        this parameter is ignored
    /// @dev Requirements:
    ///     - Sweeping wallet must be either in Live or MovingFunds state.
    ///     - If the main UTXO of the sweeping wallet exists in the storage,
    ///       the passed `mainUTXO` parameter must be equal to the stored one.
    function resolveSweepingWallet(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata mainUtxo
    )
        internal
        returns (
            Wallets.Wallet storage wallet,
            BitcoinTx.UTXO memory resolvedMainUtxo
        )
    {
        wallet = self.registeredWallets[walletPubKeyHash];

        Wallets.WalletState walletState = wallet.state;
        require(
            walletState == Wallets.WalletState.Live ||
                walletState == Wallets.WalletState.MovingFunds,
            "Wallet must be in Live or MovingFunds state"
        );

        // Check if the main UTXO for given wallet exists. If so, validate
        // passed main UTXO data against the stored hash and use them for
        // further processing. If no main UTXO exists, use empty data.
        resolvedMainUtxo = BitcoinTx.UTXO(bytes32(0), 0, 0);
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
        BridgeState.Storage storage self,
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

            Deposit.DepositRequest storage deposit = self.deposits[
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

                // Main UTXO used as an input, mark it as spent.
                self.spentMainUTXOs[
                    uint256(
                        keccak256(
                            abi.encodePacked(outpointTxHash, outpointIndex)
                        )
                    )
                ] = true;
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
}
