// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../bridge/EcdsaLib.sol";

/// @dev This is a contract implemented to test EcdsaLib library directly.
contract TestEcdsaLib {
    function compressPublicKey(bytes32 x, bytes32 y)
        public
        pure
        returns (bytes memory)
    {
        return EcdsaLib.compressPublicKey(x, y);
    }
}
