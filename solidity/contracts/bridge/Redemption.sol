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
import "./Wallets.sol";

import "../bank/Bank.sol";

/// @notice Aggregates functions common to the redemption transaction proof
///         validation and to the moving funds transaction proof validation.
library OutboundTx {
    using BTCUtils for bytes;

    /// @notice Checks whether an outbound Bitcoin transaction performed from
    ///         the given wallet has an input vector that contains a single
    ///         input referring to the wallet's main UTXO. Marks that main UTXO
    ///         as correctly spent if the validation succeeds. Reverts otherwise.
    ///         There are two outbound transactions from a wallet possible: a
    ///         redemption transaction or a moving funds to another wallet
    ///         transaction.
    /// @param walletOutboundTxInputVector Bitcoin outbound transaction's input
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVin` function
    ///        before it is passed here
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain.
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    //         HASH160 over the compressed ECDSA public key) of the wallet which
    ///        performed the outbound transaction.
    function processWalletOutboundTxInput(
        BridgeState.Storage storage self,
        bytes memory walletOutboundTxInputVector,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes20 walletPubKeyHash
    ) internal {
        // Assert that main UTXO for passed wallet exists in storage.
        bytes32 mainUtxoHash = self
            .registeredWallets[walletPubKeyHash]
            .mainUtxoHash;
        require(mainUtxoHash != bytes32(0), "No main UTXO for given wallet");

        // Assert that passed main UTXO parameter is the same as in storage and
        // can be used for further processing.
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

        // Assert that the single outbound transaction input actually
        // refers to the wallet's main UTXO.
        (
            bytes32 outpointTxHash,
            uint32 outpointIndex
        ) = parseWalletOutboundTxInput(walletOutboundTxInputVector);
        require(
            mainUtxo.txHash == outpointTxHash &&
                mainUtxo.txOutputIndex == outpointIndex,
            "Outbound transaction input must point to the wallet's main UTXO"
        );

        // Main UTXO used as an input, mark it as spent.
        self.spentMainUTXOs[
            uint256(
                keccak256(
                    abi.encodePacked(mainUtxo.txHash, mainUtxo.txOutputIndex)
                )
            )
        ] = true;
    }

    /// @notice Parses the input vector of an outbound Bitcoin transaction
    ///         performed from the given wallet. It extracts the single input
    ///         then the transaction hash and output index from its outpoint.
    ///         There are two outbound transactions from a wallet possible: a
    ///         redemption transaction or a moving funds to another wallet
    ///         transaction.
    /// @param walletOutboundTxInputVector Bitcoin outbound transaction input
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVin` function
    ///        before it is passed here
    /// @return outpointTxHash 32-byte hash of the Bitcoin transaction which is
    ///         pointed in the input's outpoint.
    /// @return outpointIndex 4-byte index of the Bitcoin transaction output
    ///         which is pointed in the input's outpoint.
    function parseWalletOutboundTxInput(
        bytes memory walletOutboundTxInputVector
    ) internal pure returns (bytes32 outpointTxHash, uint32 outpointIndex) {
        // To determine the total number of Bitcoin transaction inputs,
        // we need to parse the compactSize uint (VarInt) the input vector is
        // prepended by. That compactSize uint encodes the number of vector
        // elements using the format presented in:
        // https://developer.bitcoin.org/reference/transactions.html#compactsize-unsigned-integers
        // We don't need asserting the compactSize uint is parseable since it
        // was already checked during `validateVin` validation.
        // See `BitcoinTx.inputVector` docs for more details.
        (, uint256 inputsCount) = walletOutboundTxInputVector.parseVarInt();
        require(
            inputsCount == 1,
            "Outbound transaction must have a single input"
        );

        bytes memory input = walletOutboundTxInputVector.extractInputAtIndex(0);

        outpointTxHash = input.extractInputTxIdLE();

        outpointIndex = BTCUtils.reverseUint32(
            uint32(input.extractTxIndexLE())
        );

        // There is only one input in the transaction. Input has an outpoint
        // field that is a reference to the transaction being spent (see
        // `BitcoinTx` docs). The outpoint contains the hash of the transaction
        // to spend (`outpointTxHash`) and the index of the specific output
        // from that transaction (`outpointIndex`).
        return (outpointTxHash, outpointIndex);
    }
}

library Redemption {
    using BridgeState for BridgeState.Storage;
    using Wallets for BridgeState.Storage;
    using BitcoinTx for BridgeState.Storage;

    using BTCUtils for bytes;
    using BytesLib for bytes;

    /// @notice Represents a redemption request.
    struct RedemptionRequest {
        // ETH address of the redeemer who created the request.
        address redeemer;
        // Requested TBTC amount in satoshi.
        uint64 requestedAmount;
        // Treasury TBTC fee in satoshi at the moment of request creation.
        uint64 treasuryFee;
        // Transaction maximum BTC fee in satoshi at the moment of request
        // creation.
        uint64 txMaxFee;
        // UNIX timestamp the request was created at.
        uint32 requestedAt;
    }

    /// @notice Represents an outcome of the redemption Bitcoin transaction
    ///         outputs processing.
    struct RedemptionTxOutputsInfo {
        // Total TBTC value in satoshi that should be burned by the Bridge.
        // It includes the total amount of all BTC redeemed in the transaction
        // and the fee paid to BTC miners for the redemption transaction.
        uint64 totalBurnableValue;
        // Total TBTC value in satoshi that should be transferred to
        // the treasury. It is a sum of all treasury fees paid by all
        // redeemers included in the redemption transaction.
        uint64 totalTreasuryFee;
        // Index of the change output. The change output becomes
        // the new main wallet's UTXO.
        uint32 changeIndex;
        // Value in satoshi of the change output.
        uint64 changeValue;
    }

    /// @notice Represents temporary information needed during the processing of
    ///         the redemption Bitcoin transaction outputs. This structure is an
    ///         internal one and should not be exported outside of the redemption
    ///         transaction processing code.
    /// @dev Allows to mitigate "stack too deep" errors on EVM.
    struct RedemptionTxOutputsProcessingInfo {
        // The first output starting index in the transaction.
        uint256 outputStartingIndex;
        // The number of outputs in the transaction.
        uint256 outputsCount;
        // P2PKH script for the wallet. Needed to determine the change output.
        bytes32 walletP2PKHScriptKeccak;
        // P2WPKH script for the wallet. Needed to determine the change output.
        bytes32 walletP2WPKHScriptKeccak;
    }

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
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes calldata redeemerOutputScript,
        uint64 amount
    ) external {
        Wallets.Wallet storage wallet = self.registeredWallets[
            walletPubKeyHash
        ];

        require(
            wallet.state == Wallets.WalletState.Live,
            "Wallet must be in Live state"
        );

        bytes32 mainUtxoHash = wallet.mainUtxoHash;
        require(
            mainUtxoHash != bytes32(0),
            "No main UTXO for the given wallet"
        );
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

        // TODO: Confirm if `walletPubKeyHash` should be validated by checking
        //       if it is the oldest one who can handle the request. This will
        //       be suggested by the dApp but may not be respected by users who
        //       interact directly with the contract. Do we need to enforce it
        //       here? One option is not to enforce it, to save on gas, but if
        //       we see this rule is not respected, upgrade Bridge contract to
        //       require it.

        // Validate if redeemer output script is a correct standard type
        // (P2PKH, P2WPKH, P2SH or P2WSH). This is done by building a stub
        // output with 0 as value and using `BTCUtils.extractHash` on it. Such
        // a function extracts the payload properly only from standard outputs
        // so if it succeeds, we have a guarantee the redeemer output script
        // is proper. Worth to note `extractHash` ignores the value at all
        // so this is why we can use 0 safely. This way of validation is the
        // same as in tBTC v1.
        bytes memory redeemerOutputScriptPayload = abi
            .encodePacked(bytes8(0), redeemerOutputScript)
            .extractHash();
        require(
            redeemerOutputScriptPayload.length > 0,
            "Redeemer output script must be a standard type"
        );
        // Check if the redeemer output script payload does not point to the
        // wallet public key hash.
        require(
            keccak256(abi.encodePacked(walletPubKeyHash)) !=
                keccak256(redeemerOutputScriptPayload),
            "Redeemer output script must not point to the wallet PKH"
        );

        require(
            amount >= self.redemptionDustThreshold,
            "Redemption amount too small"
        );

        // The redemption key is built on top of the wallet public key hash
        // and redeemer output script pair. That means there can be only one
        // request asking for redemption from the given wallet to the given
        // BTC script at the same time.
        uint256 redemptionKey = uint256(
            keccak256(abi.encodePacked(walletPubKeyHash, redeemerOutputScript))
        );

        // Check if given redemption key is not used by a pending redemption.
        // There is no need to check for existence in `timedOutRedemptions`
        // since the wallet's state is changed to other than Live after
        // first time out is reported so making new requests is not possible.
        // slither-disable-next-line incorrect-equality
        require(
            self.pendingRedemptions[redemptionKey].requestedAt == 0,
            "There is a pending redemption request from this wallet to the same address"
        );

        // No need to check whether `amount - treasuryFee - txMaxFee > 0`
        // since the `redemptionDustThreshold` should force that condition
        // to be always true.
        uint64 treasuryFee = self.redemptionTreasuryFeeDivisor > 0
            ? amount / self.redemptionTreasuryFeeDivisor
            : 0;
        uint64 txMaxFee = self.redemptionTxMaxFee;

        // The main wallet UTXO's value doesn't include all pending redemptions.
        // To determine if the requested redemption can be performed by the
        // wallet we need to subtract the total value of all pending redemptions
        // from that wallet's main UTXO value. Given that the treasury fee is
        // not redeemed from the wallet, we are subtracting it.
        wallet.pendingRedemptionsValue += amount - treasuryFee;
        require(
            mainUtxo.txOutputValue >= wallet.pendingRedemptionsValue,
            "Insufficient wallet funds"
        );

        self.pendingRedemptions[redemptionKey] = RedemptionRequest(
            msg.sender,
            amount,
            treasuryFee,
            txMaxFee,
            /* solhint-disable-next-line not-rely-on-time */
            uint32(block.timestamp)
        );

        emit RedemptionRequested(
            walletPubKeyHash,
            redeemerOutputScript,
            msg.sender,
            amount,
            treasuryFee,
            txMaxFee
        );

        self.bank.transferBalanceFrom(msg.sender, address(this), amount);
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
        BridgeState.Storage storage self,
        BitcoinTx.Info calldata redemptionTx,
        BitcoinTx.Proof calldata redemptionProof,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes20 walletPubKeyHash
    ) external {
        // TODO: Just as for `submitSweepProof`, fail early if the function
        //       call gets frontrunned. See discussion:
        //       https://github.com/keep-network/tbtc-v2/pull/106#discussion_r801745204

        // The actual transaction proof is performed here. After that point, we
        // can assume the transaction happened on Bitcoin chain and has
        // a sufficient number of confirmations as determined by
        // `txProofDifficultyFactor` constant.
        bytes32 redemptionTxHash = self.validateProof(
            redemptionTx,
            redemptionProof
        );

        // Process the redemption transaction input. Specifically, check if it
        // refers to the expected wallet's main UTXO.
        OutboundTx.processWalletOutboundTxInput(
            self,
            redemptionTx.inputVector,
            mainUtxo,
            walletPubKeyHash
        );

        Wallets.Wallet storage wallet = self.registeredWallets[
            walletPubKeyHash
        ];

        Wallets.WalletState walletState = wallet.state;
        require(
            walletState == Wallets.WalletState.Live ||
                walletState == Wallets.WalletState.MovingFunds,
            "Wallet must be in Live or MovingFunds state"
        );

        // Process redemption transaction outputs to extract some info required
        // for further processing.
        RedemptionTxOutputsInfo memory outputsInfo = processRedemptionTxOutputs(
            self,
            redemptionTx.outputVector,
            walletPubKeyHash
        );

        if (outputsInfo.changeValue > 0) {
            // If the change value is grater than zero, it means the change
            // output exists and can be used as new wallet's main UTXO.
            wallet.mainUtxoHash = keccak256(
                abi.encodePacked(
                    redemptionTxHash,
                    outputsInfo.changeIndex,
                    outputsInfo.changeValue
                )
            );
        } else {
            // If the change value is zero, it means the change output doesn't
            // exists and no funds left on the wallet. Delete the main UTXO
            // for that wallet to represent that state in a proper way.
            delete wallet.mainUtxoHash;
        }

        wallet.pendingRedemptionsValue -= outputsInfo.totalBurnableValue;

        emit RedemptionsCompleted(walletPubKeyHash, redemptionTxHash);

        self.bank.decreaseBalance(outputsInfo.totalBurnableValue);
        self.bank.transferBalance(self.treasury, outputsInfo.totalTreasuryFee);
    }

    /// @notice Processes the Bitcoin redemption transaction output vector.
    ///         It extracts each output and tries to identify it as a pending
    ///         redemption request, reported timed out request, or change.
    ///         Reverts if one of the outputs cannot be recognized properly.
    ///         This function also marks each request as processed by removing
    ///         them from `pendingRedemptions` mapping.
    /// @param redemptionTxOutputVector Bitcoin redemption transaction output
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVout` function
    ///        before it is passed here
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    //         HASH160 over the compressed ECDSA public key) of the wallet which
    ///        performed the redemption transaction.
    /// @return info Outcomes of the processing.
    function processRedemptionTxOutputs(
        BridgeState.Storage storage self,
        bytes memory redemptionTxOutputVector,
        bytes20 walletPubKeyHash
    ) internal returns (RedemptionTxOutputsInfo memory info) {
        // Determining the total number of redemption transaction outputs in
        // the same way as for number of inputs. See `BitcoinTx.outputVector`
        // docs for more details.
        (
            uint256 outputsCompactSizeUintLength,
            uint256 outputsCount
        ) = redemptionTxOutputVector.parseVarInt();

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

        // Calculate the keccak256 for two possible wallet's P2PKH or P2WPKH
        // scripts that can be used to lock the change. This is done upfront to
        // save on gas. Both scripts have a strict format defined by Bitcoin.
        //
        // The P2PKH script has the byte format: <0x1976a914> <20-byte PKH> <0x88ac>.
        // According to https://en.bitcoin.it/wiki/Script#Opcodes this translates to:
        // - 0x19: Byte length of the entire script
        // - 0x76: OP_DUP
        // - 0xa9: OP_HASH160
        // - 0x14: Byte length of the public key hash
        // - 0x88: OP_EQUALVERIFY
        // - 0xac: OP_CHECKSIG
        // which matches the P2PKH structure as per:
        // https://en.bitcoin.it/wiki/Transaction#Pay-to-PubkeyHash
        bytes32 walletP2PKHScriptKeccak = keccak256(
            abi.encodePacked(hex"1976a914", walletPubKeyHash, hex"88ac")
        );
        // The P2WPKH script has the byte format: <0x160014> <20-byte PKH>.
        // According to https://en.bitcoin.it/wiki/Script#Opcodes this translates to:
        // - 0x16: Byte length of the entire script
        // - 0x00: OP_0
        // - 0x14: Byte length of the public key hash
        // which matches the P2WPKH structure as per:
        // https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#P2WPKH
        bytes32 walletP2WPKHScriptKeccak = keccak256(
            abi.encodePacked(hex"160014", walletPubKeyHash)
        );

        return
            processRedemptionTxOutputs(
                self,
                redemptionTxOutputVector,
                walletPubKeyHash,
                RedemptionTxOutputsProcessingInfo(
                    outputStartingIndex,
                    outputsCount,
                    walletP2PKHScriptKeccak,
                    walletP2WPKHScriptKeccak
                )
            );
    }

    /// @notice Processes all outputs from the redemption transaction. Tries to
    ///         identify output as a change output, pending redemption request
    //          or reported redemption. Reverts if one of the outputs cannot be
    ///         recognized properly. Marks each request as processed by removing
    ///         them from `pendingRedemptions` mapping.
    /// @param redemptionTxOutputVector Bitcoin redemption transaction output
    ///        vector. This function assumes vector's structure is valid so it
    ///        must be validated using e.g. `BTCUtils.validateVout` function
    ///        before it is passed here
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    //         HASH160 over the compressed ECDSA public key) of the wallet which
    ///        performed the redemption transaction.
    /// @param processInfo RedemptionTxOutputsProcessingInfo identifying output
    ///        starting index, the number of outputs and possible wallet change
    ///        P2PKH and P2WPKH scripts.
    function processRedemptionTxOutputs(
        BridgeState.Storage storage self,
        bytes memory redemptionTxOutputVector,
        bytes20 walletPubKeyHash,
        RedemptionTxOutputsProcessingInfo memory processInfo
    ) internal returns (RedemptionTxOutputsInfo memory resultInfo) {
        // Helper variable that counts the number of processed redemption
        // outputs. Redemptions can be either pending or reported as timed out.
        // TODO: Revisit the approach with redemptions count according to
        //       https://github.com/keep-network/tbtc-v2/pull/128#discussion_r808237765
        uint256 processedRedemptionsCount = 0;

        // Outputs processing loop.
        for (uint256 i = 0; i < processInfo.outputsCount; i++) {
            // TODO: Check if we can optimize gas costs by adding
            //       `extractValueAt` and `extractHashAt` in `bitcoin-spv-sol`
            //       in order to avoid allocating bytes in memory.
            uint256 outputLength = redemptionTxOutputVector
                .determineOutputLengthAt(processInfo.outputStartingIndex);
            bytes memory output = redemptionTxOutputVector.slice(
                processInfo.outputStartingIndex,
                outputLength
            );

            // Extract the value from given output.
            uint64 outputValue = output.extractValue();
            // The output consists of an 8-byte value and a variable length
            // script. To extract that script we slice the output starting from
            // 9th byte until the end.
            bytes memory outputScript = output.slice(8, output.length - 8);

            if (
                resultInfo.changeValue == 0 &&
                (keccak256(outputScript) ==
                    processInfo.walletP2PKHScriptKeccak ||
                    keccak256(outputScript) ==
                    processInfo.walletP2WPKHScriptKeccak) &&
                outputValue > 0
            ) {
                // If we entered here, that means the change output with a
                // proper non-zero value was found.
                resultInfo.changeIndex = uint32(i);
                resultInfo.changeValue = outputValue;
            } else {
                // If we entered here, that the means the given output is
                // supposed to represent a redemption.
                (
                    uint64 burnableValue,
                    uint64 treasuryFee
                ) = processNonChangeRedemptionTxOutput(
                        self,
                        walletPubKeyHash,
                        outputScript,
                        outputValue
                    );
                resultInfo.totalBurnableValue += burnableValue;
                resultInfo.totalTreasuryFee += treasuryFee;
                processedRedemptionsCount++;
            }

            // Make the `outputStartingIndex` pointing to the next output by
            // increasing it by current output's length.
            processInfo.outputStartingIndex += outputLength;
        }

        // Protect against the cases when there is only a single change output
        // referring back to the wallet PKH and just burning main UTXO value
        // for transaction fees.
        require(
            processedRedemptionsCount > 0,
            "Redemption transaction must process at least one redemption"
        );
    }

    /// @notice Processes a single redemption transaction output. Tries to
    ///         identify output as a pending redemption request or reported
    ///         redemption timeout. Output script passed to this function must
    ///         not be the change output. Such output needs to be identified
    ///         separately before calling this function.
    ///         Reverts if output is neither requested pending redemption nor
    ///         requested and reported timed-out redemption.
    ///         This function also marks each pending request as processed by
    ///         removing them from `pendingRedemptions` mapping.
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    //         HASH160 over the compressed ECDSA public key) of the wallet which
    ///        performed the redemption transaction.
    /// @param outputScript Non-change output script to be processed
    /// @param outputValue Value of the output being processed
    /// @return burnableValue The value burnable as a result of processing this
    ///         single redemption output. This value needs to be summed up with
    ///         burnable values of all other outputs to evaluate total burnable
    ///         value for the entire redemption transaction. This value is 0
    ///         for a timed-out redemption request.
    /// @return treasuryFee The treasury fee from this single redemption output.
    ///         This value needs to be summed up with treasury fees of all other
    ///         outputs to evaluate the total treasury fee for the entire
    ///         redemption transaction. This value is 0 for a timed-out
    ///         redemption request.
    function processNonChangeRedemptionTxOutput(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash,
        bytes memory outputScript,
        uint64 outputValue
    ) internal returns (uint64 burnableValue, uint64 treasuryFee) {
        // This function should be called only if the given output is
        // supposed to represent a redemption. Build the redemption key
        // to perform that check.
        uint256 redemptionKey = uint256(
            keccak256(abi.encodePacked(walletPubKeyHash, outputScript))
        );

        if (self.pendingRedemptions[redemptionKey].requestedAt != 0) {
            // If we entered here, that means the output was identified
            // as a pending redemption request.
            RedemptionRequest storage request = self.pendingRedemptions[
                redemptionKey
            ];
            // Compute the request's redeemable amount as the requested
            // amount reduced by the treasury fee. The request's
            // minimal amount is then the redeemable amount reduced by
            // the maximum transaction fee.
            uint64 redeemableAmount = request.requestedAmount -
                request.treasuryFee;
            // Output value must fit between the request's redeemable
            // and minimal amounts to be deemed valid.
            require(
                redeemableAmount - request.txMaxFee <= outputValue &&
                    outputValue <= redeemableAmount,
                "Output value is not within the acceptable range of the pending request"
            );
            // Add the redeemable amount to the total burnable value
            // the Bridge will use to decrease its balance in the Bank.
            burnableValue = redeemableAmount;
            // Add the request's treasury fee to the total treasury fee
            // value the Bridge will transfer to the treasury.
            treasuryFee = request.treasuryFee;
            // Request was properly handled so remove its redemption
            // key from the mapping to make it reusable for further
            // requests.
            delete self.pendingRedemptions[redemptionKey];
        } else {
            // If we entered here, the output is not a redemption
            // request but there is still a chance the given output is
            // related to a reported timed out redemption request.
            // If so, check if the output value matches the request
            // amount to confirm this is an overdue request fulfillment
            // then bypass this output and process the subsequent
            // ones. That also means the wallet was already punished
            // for the inactivity. Otherwise, just revert.
            RedemptionRequest storage request = self.timedOutRedemptions[
                redemptionKey
            ];

            require(
                request.requestedAt != 0,
                "Output is a non-requested redemption"
            );

            uint64 redeemableAmount = request.requestedAmount -
                request.treasuryFee;

            require(
                redeemableAmount - request.txMaxFee <= outputValue &&
                    outputValue <= redeemableAmount,
                "Output value is not within the acceptable range of the timed out request"
            );
        }
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
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash,
        bytes calldata redeemerOutputScript
    ) external {
        uint256 redemptionKey = uint256(
            keccak256(abi.encodePacked(walletPubKeyHash, redeemerOutputScript))
        );
        Redemption.RedemptionRequest memory request = self.pendingRedemptions[
            redemptionKey
        ];

        require(request.requestedAt > 0, "Redemption request does not exist");
        require(
            /* solhint-disable-next-line not-rely-on-time */
            request.requestedAt + self.redemptionTimeout < block.timestamp,
            "Redemption request has not timed out"
        );

        // Update the wallet's pending redemptions value
        Wallets.Wallet storage wallet = self.registeredWallets[
            walletPubKeyHash
        ];
        wallet.pendingRedemptionsValue -=
            request.requestedAmount -
            request.treasuryFee;

        require(
            // TODO: Allow the wallets in `Closing` state when the state is added
            wallet.state == Wallets.WalletState.Live ||
                wallet.state == Wallets.WalletState.MovingFunds ||
                wallet.state == Wallets.WalletState.Terminated,
            "The wallet must be in Live, MovingFunds or Terminated state"
        );

        // It is worth noting that there is no need to check if
        // `timedOutRedemption` mapping already contains the given redemption
        // key. There is no possibility to re-use a key of a reported timed-out
        // redemption because the wallet responsible for causing the timeout is
        // moved to a state that prevents it to receive new redemption requests.

        // Move the redemption from pending redemptions to timed-out redemptions
        self.timedOutRedemptions[redemptionKey] = request;
        delete self.pendingRedemptions[redemptionKey];

        if (
            wallet.state == Wallets.WalletState.Live ||
            wallet.state == Wallets.WalletState.MovingFunds
        ) {
            // Propagate timeout consequences to the wallet
            self.notifyWalletTimedOutRedemption(walletPubKeyHash);
        }

        emit RedemptionTimedOut(walletPubKeyHash, redeemerOutputScript);

        // Return the requested amount of tokens to the redeemer
        self.bank.transferBalance(request.redeemer, request.requestedAmount);
    }
}
