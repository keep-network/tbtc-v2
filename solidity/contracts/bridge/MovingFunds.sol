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
import "./Redeem.sol";

library MovingFunds {
    using BridgeState for BridgeState.Storage;
    using Wallets for BridgeState.Storage;

    using BTCUtils for bytes;
    using BytesLib for bytes;

    event MovingFundsCommitmentSubmitted(
        bytes20 walletPubKeyHash,
        bytes20[] targetWallets
    );

    event MovingFundsCompleted(
        bytes20 walletPubKeyHash,
        bytes32 movingFundsTxHash
    );

    function submitMovingFundsCommitment(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata walletMainUtxo,
        uint32[] calldata walletMembersIDs,
        uint256 walletMemberIndex,
        bytes20[] calldata targetWallets
    ) external {
        self.notifyWalletMovingFundsCommitmentSubmitted(
            walletPubKeyHash,
            walletMainUtxo,
            walletMembersIDs,
            walletMemberIndex,
            targetWallets
        );

        emit MovingFundsCommitmentSubmitted(walletPubKeyHash, targetWallets);
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
        bytes32 movingFundsTxHash = BitcoinTx.validateProof(
            movingFundsTx,
            movingFundsProof,
            self.proofDifficultyContext()
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
        ) = processMovingFundsTxOutputs(movingFundsTx.outputVector);

        require(
            mainUtxo.txOutputValue - outputsTotalValue <=
                self.movingFundsTxMaxTotalFee,
            "Transaction fee is too high"
        );

        self.notifyWalletFundsMoved(walletPubKeyHash, targetWalletsHash);

        emit MovingFundsCompleted(walletPubKeyHash, movingFundsTxHash);
    }

    /// @notice Processes the moving funds Bitcoin transaction output vector
    ///         and extracts information required for further processing.
    /// @param movingFundsTxOutputVector Bitcoin moving funds transaction output
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVout` function
    ///        before it is passed here
    /// @return targetWalletsHash keccak256 hash over the list of actual
    ///         target wallets used in the transaction.
    /// @return outputsTotalValue Sum of all outputs values.
    /// @dev Requirements:
    ///      - The `movingFundsTxOutputVector` must be parseable, i.e. must
    ///        be validated by the caller as stated in their parameter doc.
    ///      - Each output must refer to a 20-byte public key hash.
    ///      - The total outputs value must be evenly divided over all outputs.
    function processMovingFundsTxOutputs(bytes memory movingFundsTxOutputVector)
        internal
        view
        returns (bytes32 targetWalletsHash, uint256 outputsTotalValue)
    {
        // Determining the total number of Bitcoin transaction outputs in
        // the same way as for number of inputs. See `BitcoinTx.outputVector`
        // docs for more details.
        (
            uint256 outputsCompactSizeUintLength,
            uint256 outputsCount
        ) = movingFundsTxOutputVector.parseVarInt();

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
            uint256 outputLength = movingFundsTxOutputVector
                .determineOutputLengthAt(outputStartingIndex);

            bytes memory output = movingFundsTxOutputVector.slice(
                outputStartingIndex,
                outputLength
            );

            // Extract the output script payload.
            bytes memory targetWalletPubKeyHashBytes = output.extractHash();
            // Output script payload must refer to a known wallet public key
            // hash which is always 20-byte.
            require(
                targetWalletPubKeyHashBytes.length == 20,
                "Target wallet public key hash must have 20 bytes"
            );

            bytes20 targetWalletPubKeyHash = targetWalletPubKeyHashBytes
                .slice20(0);

            // The next step is making sure that the 20-byte public key hash
            // is actually used in the right context of a P2PKH or P2WPKH
            // output. To do so, we must extract the full script from the output
            // and compare with the expected P2PKH and P2WPKH scripts
            // referring to that 20-byte public key hash. The output consists
            // of an 8-byte value and a variable length script. To extract the
            // script we slice the output starting from 9th byte until the end.
            bytes32 outputScriptKeccak = keccak256(
                output.slice(8, output.length - 8)
            );
            // Build the expected P2PKH script which has the following byte
            // format: <0x1976a914> <20-byte PKH> <0x88ac>. According to
            // https://en.bitcoin.it/wiki/Script#Opcodes this translates to:
            // - 0x19: Byte length of the entire script
            // - 0x76: OP_DUP
            // - 0xa9: OP_HASH160
            // - 0x14: Byte length of the public key hash
            // - 0x88: OP_EQUALVERIFY
            // - 0xac: OP_CHECKSIG
            // which matches the P2PKH structure as per:
            // https://en.bitcoin.it/wiki/Transaction#Pay-to-PubkeyHash
            bytes32 targetWalletP2PKHScriptKeccak = keccak256(
                abi.encodePacked(
                    hex"1976a914",
                    targetWalletPubKeyHash,
                    hex"88ac"
                )
            );
            // Build the expected P2WPKH script which has the following format:
            // <0x160014> <20-byte PKH>. According to
            // https://en.bitcoin.it/wiki/Script#Opcodes this translates to:
            // - 0x16: Byte length of the entire script
            // - 0x00: OP_0
            // - 0x14: Byte length of the public key hash
            // which matches the P2WPKH structure as per:
            // https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#P2WPKH
            bytes32 targetWalletP2WPKHScriptKeccak = keccak256(
                abi.encodePacked(hex"160014", targetWalletPubKeyHash)
            );
            // Make sure the actual output script matches either the P2PKH
            // or P2WPKH format.
            require(
                outputScriptKeccak == targetWalletP2PKHScriptKeccak ||
                    outputScriptKeccak == targetWalletP2WPKHScriptKeccak,
                "Output must be P2PKH or P2WPKH"
            );

            // Add the wallet public key hash to the list that will be used
            // to build the result list hash. There is no need to check if
            // given output is a change here because the actual target wallet
            // list must be exactly the same as the pre-committed target wallet
            // list which is guaranteed to be valid.
            targetWallets[i] = targetWalletPubKeyHash;

            // Extract the value from given output.
            outputsValues[i] = output.extractValue();
            outputsTotalValue += outputsValues[i];

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
}
