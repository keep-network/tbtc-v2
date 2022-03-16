pragma solidity ^0.8.9;

import "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";

library EcdsaLib {
    using BytesLib for bytes;

    /// @notice Converts public key X and Y coordinates (32-byte each) to a
    ///         compressed public key (33-byte). Compressed public key is X
    ///         coordinate prefixed with `02` or `03` based on the Y coordinate parity.
    ///         It is expected that the uncompressed public key is stripped
    ///         (i.e. it is not prefixed with `04`).
    /// @param x Wallet's public key's X coordinate.
    /// @param y Wallet's public key's Y coordinate.
    /// @return Compressed public key (33-byte), prefixed with `02` or `03`.
    function compressPublicKey(bytes32 x, bytes32 y)
        internal
        pure
        returns (bytes memory)
    {
        bytes1 prefix;
        if (uint256(y) % 2 == 0) {
            prefix = hex"02";
        } else {
            prefix = hex"03";
        }

        return bytes.concat(prefix, x);
    }

    /// @notice Converts uncompressed public key (64-byte) to a compressed public
    ///         key (33-byte). Uncompressed public key is expected to be concatenation
    ///         of X and Y coordinates (32-byte each). Compressed public key is X
    ///         coordinate prefixed with `02` or `03` based on the Y coordinate parity.
    ///         It is expected that the uncompressed public key is stripped
    ///         (i.e. it is not prefixed with `04`).
    /// @param uncompressedPublicKey Public key in uncompressed format as a
    ///        concatenation of X and Y coordinates (32-byte each).
    /// @return Compressed public key (33-byte), prefixed with `02` or `03`.
    function compressPublicKey(bytes memory uncompressedPublicKey)
        internal
        pure
        returns (bytes memory)
    {
        require(
            uncompressedPublicKey.length == 64,
            "Invalid public key length"
        );

        bytes32 x = uncompressedPublicKey.slice32(0);
        bytes32 y = uncompressedPublicKey.slice32(32);

        bytes1 prefix;
        if (uint256(y) % 2 == 0) {
            prefix = hex"02";
        } else {
            prefix = hex"03";
        }

        return bytes.concat(prefix, x);
    }
}
