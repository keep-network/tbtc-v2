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
import {ValidateSPV} from "@keep-network/bitcoin-spv-sol/contracts/ValidateSPV.sol";

import "./BridgeState.sol";

/// @title Bitcoin transaction
/// @notice Allows to reference Bitcoin raw transaction in Solidity.
/// @dev See https://developer.bitcoin.org/reference/transactions.html#raw-transaction-format
///
///      Raw Bitcoin transaction data:
///
///      | Bytes  |     Name     |        BTC type        |        Description        |
///      |--------|--------------|------------------------|---------------------------|
///      | 4      | version      | int32_t (LE)           | TX version number         |
///      | varies | tx_in_count  | compactSize uint (LE)  | Number of TX inputs       |
///      | varies | tx_in        | txIn[]                 | TX inputs                 |
///      | varies | tx_out count | compactSize uint (LE)  | Number of TX outputs      |
///      | varies | tx_out       | txOut[]                | TX outputs                |
///      | 4      | lock_time    | uint32_t (LE)          | Unix time or block number |
///
//
///      Non-coinbase transaction input (txIn):
///
///      | Bytes  |       Name       |        BTC type        |                 Description                 |
///      |--------|------------------|------------------------|---------------------------------------------|
///      | 36     | previous_output  | outpoint               | The previous outpoint being spent           |
///      | varies | script bytes     | compactSize uint (LE)  | The number of bytes in the signature script |
///      | varies | signature script | char[]                 | The signature script, empty for P2WSH       |
///      | 4      | sequence         | uint32_t (LE)          | Sequence number                             |
///
///
///      The reference to transaction being spent (outpoint):
///
///      | Bytes | Name  |   BTC type    |               Description                |
///      |-------|-------|---------------|------------------------------------------|
///      |    32 | hash  | char[32]      | Hash of the transaction to spend         |
///      |    4  | index | uint32_t (LE) | Index of the specific output from the TX |
///
///
///      Transaction output (txOut):
///
///      | Bytes  |      Name       |     BTC type          |             Description              |
///      |--------|-----------------|-----------------------|--------------------------------------|
///      | 8      | value           | int64_t (LE)          | Number of satoshis to spend          |
///      | 1+     | pk_script_bytes | compactSize uint (LE) | Number of bytes in the pubkey script |
///      | varies | pk_script       | char[]                | Pubkey script                        |
///
///      compactSize uint format:
///
///      |                  Value                  | Bytes |                    Format                    |
///      |-----------------------------------------|-------|----------------------------------------------|
///      | >= 0 && <= 252                          | 1     | uint8_t                                      |
///      | >= 253 && <= 0xffff                     | 3     | 0xfd followed by the number as uint16_t (LE) |
///      | >= 0x10000 && <= 0xffffffff             | 5     | 0xfe followed by the number as uint32_t (LE) |
///      | >= 0x100000000 && <= 0xffffffffffffffff | 9     | 0xff followed by the number as uint64_t (LE) |
///
///      (*) compactSize uint is often references as VarInt)
///
library BitcoinTx {
    using BTCUtils for bytes;
    using BTCUtils for uint256;
    using BytesLib for bytes;
    using ValidateSPV for bytes;
    using ValidateSPV for bytes32;

    /// @notice Represents Bitcoin transaction data.
    struct Info {
        /// @notice Bitcoin transaction version
        /// @dev `version` from raw Bitcoin transaction data.
        ///      Encoded as 4-bytes signed integer, little endian.
        bytes4 version;
        /// @notice All Bitcoin transaction inputs, prepended by the number of
        ///         transaction inputs.
        /// @dev `tx_in_count | tx_in` from raw Bitcoin transaction data.
        ///
        ///      The number of transaction inputs encoded as compactSize
        ///      unsigned integer, little-endian.
        ///
        ///      Note that some popular block explorers reverse the order of
        ///      bytes from `outpoint`'s `hash` and display it as big-endian.
        ///      Solidity code of Bridge expects hashes in little-endian, just
        ///      like they are represented in a raw Bitcoin transaction.
        bytes inputVector;
        /// @notice All Bitcoin transaction outputs prepended by the number of
        ///         transaction outputs.
        /// @dev `tx_out_count | tx_out` from raw Bitcoin transaction data.
        ///
        ///       The number of transaction outputs encoded as a compactSize
        ///       unsigned integer, little-endian.
        bytes outputVector;
        /// @notice Bitcoin transaction locktime.
        ///
        /// @dev `lock_time` from raw Bitcoin transaction data.
        ///      Encoded as 4-bytes unsigned integer, little endian.
        bytes4 locktime;
    }

    /// @notice Represents data needed to perform a Bitcoin SPV proof.
    struct Proof {
        /// @notice The merkle proof of transaction inclusion in a block.
        bytes merkleProof;
        /// @notice Transaction index in the block (0-indexed).
        uint256 txIndexInBlock;
        /// @notice Single byte-string of 80-byte bitcoin headers,
        ///         lowest height first.
        bytes bitcoinHeaders;
    }

    /// @notice Represents info about an unspent transaction output.
    struct UTXO {
        /// @notice Hash of the transaction the output belongs to.
        /// @dev Byte order corresponds to the Bitcoin internal byte order.
        bytes32 txHash;
        /// @notice Index of the transaction output (0-indexed).
        uint32 txOutputIndex;
        /// @notice Value of the transaction output.
        uint64 txOutputValue;
    }

    /// @notice Represents Bitcoin signature in the R/S/V format.
    struct RSVSignature {
        /// @notice Signature r value.
        bytes32 r;
        /// @notice Signature s value.
        bytes32 s;
        /// @notice Signature recovery value.
        uint8 v;
    }

    /// @notice Validates the SPV proof of the Bitcoin transaction.
    ///         Reverts in case the validation or proof verification fail.
    /// @param txInfo Bitcoin transaction data
    /// @param proof Bitcoin proof data
    /// @return txHash Proven 32-byte transaction hash.
    function validateProof(
        BridgeState.Storage storage self,
        Info calldata txInfo,
        Proof calldata proof
    ) internal view returns (bytes32 txHash) {
        require(
            txInfo.inputVector.validateVin(),
            "Invalid input vector provided"
        );
        require(
            txInfo.outputVector.validateVout(),
            "Invalid output vector provided"
        );

        txHash = abi
            .encodePacked(
                txInfo.version,
                txInfo.inputVector,
                txInfo.outputVector,
                txInfo.locktime
            )
            .hash256View();

        require(
            txHash.prove(
                proof.bitcoinHeaders.extractMerkleRootLE(),
                proof.merkleProof,
                proof.txIndexInBlock
            ),
            "Tx merkle proof is not valid for provided header and tx hash"
        );

        evaluateProofDifficulty(self, proof.bitcoinHeaders);

        return txHash;
    }

    /// @notice Evaluates the given Bitcoin proof difficulty against the actual
    ///         Bitcoin chain difficulty provided by the relay oracle.
    ///         Reverts in case the evaluation fails.
    /// @param bitcoinHeaders Bitcoin headers chain being part of the SPV
    ///        proof. Used to extract the observed proof difficulty
    function evaluateProofDifficulty(
        BridgeState.Storage storage self,
        bytes memory bitcoinHeaders
    ) internal view {
        IRelay relay = self.relay;
        uint256 currentEpochDifficulty = relay.getCurrentEpochDifficulty();
        uint256 previousEpochDifficulty = relay.getPrevEpochDifficulty();

        uint256 requestedDiff = 0;
        uint256 firstHeaderDiff = bitcoinHeaders
            .extractTarget()
            .calculateDifficulty();

        if (firstHeaderDiff == currentEpochDifficulty) {
            requestedDiff = currentEpochDifficulty;
        } else if (firstHeaderDiff == previousEpochDifficulty) {
            requestedDiff = previousEpochDifficulty;
        } else {
            revert("Not at current or previous difficulty");
        }

        uint256 observedDiff = bitcoinHeaders.validateHeaderChain();

        require(
            observedDiff != ValidateSPV.getErrBadLength(),
            "Invalid length of the headers chain"
        );
        require(
            observedDiff != ValidateSPV.getErrInvalidChain(),
            "Invalid headers chain"
        );
        require(
            observedDiff != ValidateSPV.getErrLowWork(),
            "Insufficient work in a header"
        );

        require(
            observedDiff >= requestedDiff * self.txProofDifficultyFactor,
            "Insufficient accumulated difficulty in header chain"
        );
    }

    /// @notice Processes a P2PKH or P2WPKH output. Reverts if the validation fails.
    /// @param output The transaction output
    /// @return pubKeyHash 20-byte public key hash the output locks funds on
    /// @dev Requirements:
    ///      - The output must be of P2PKH or P2WPKH type and lock the funds
    ///        on a 20-byte public key hash
    function processPubKeyHashTxOutput(
        BridgeState.Storage storage,
        bytes memory output
    ) internal view returns (bytes20 pubKeyHash) {
        bytes memory pubKeyHashBytes = output.extractHash();

        require(
            pubKeyHashBytes.length == 20,
            "Output's public key hash must have 20 bytes"
        );

        pubKeyHash = pubKeyHashBytes.slice20(0);

        // We need to make sure that the 20-byte public key hash
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
        bytes32 P2PKHScriptKeccak = keccak256(
            abi.encodePacked(hex"1976a914", pubKeyHash, hex"88ac")
        );
        // Build the expected P2WPKH script which has the following format:
        // <0x160014> <20-byte PKH>. According to
        // https://en.bitcoin.it/wiki/Script#Opcodes this translates to:
        // - 0x16: Byte length of the entire script
        // - 0x00: OP_0
        // - 0x14: Byte length of the public key hash
        // which matches the P2WPKH structure as per:
        // https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#P2WPKH
        bytes32 P2WPKHScriptKeccak = keccak256(
            abi.encodePacked(hex"160014", pubKeyHash)
        );
        // Make sure the actual output script matches either the P2PKH
        // or P2WPKH format.
        require(
            outputScriptKeccak == P2PKHScriptKeccak ||
                outputScriptKeccak == P2WPKHScriptKeccak,
            "Output must be P2PKH or P2WPKH"
        );

        return pubKeyHash;
    }
}
