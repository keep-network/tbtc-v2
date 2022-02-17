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

pragma solidity 0.8.4;

/// @title Bitcoin transaction
/// @notice Allows to reference Bitcoin raw transaction in Solidity.
/// @dev See https://developer.bitcoin.org/reference/transactions.html#raw-transaction-format
///
///      Raw Bitcon transaction data:
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
    /// @notice Represents Bitcoin transaction data for funding BTC deposit
    ///         P2(W)SH transaction.
    struct Info {
        /// @notice Bitcoin transaction version
        /// @dev `version` from raw Bitcon transaction data.
        ///      Encoded as 4-bytes signed integer, little endian.
        bytes4 version;
        /// @notice All Bitcoin transaction inputs, prepended by the number of
        ///         transaction inputs.
        /// @dev `tx_in_count | tx_in` from raw Bitcon transaction data.
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
}
