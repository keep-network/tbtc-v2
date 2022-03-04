// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../bridge/EcdsaLib.sol";

/// @dev This is a contract implemented to test EcdsaLib library directly.
contract TestEcdsaLib {
    using EcdsaLib for bytes;

    function compressPublicKey(bytes memory uncompressedPublicKey)
        public
        pure
        returns (bytes memory)
    {
        return uncompressedPublicKey.compressPublicKey();
    }
}
