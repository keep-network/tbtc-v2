// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../relay/Relay.sol";

contract RelayStub is Relay {
    // Gas-reporting version of validateChain
    function validateChainGasReport(bytes memory headers)
        external
        returns (uint256)
    {
        return this.validateChain(headers);
    }
}
