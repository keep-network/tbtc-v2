// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../relay/SparseRelay.sol";

contract SparseRelayStub is SparseRelay {
    // Gas-reporting version of validateChain
    function validateGasReport(bytes memory headers)
        external
        returns (bool)
    {
        return this.validate(headers);
    }
}
