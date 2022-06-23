// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../relay/LightRelay.sol";

contract RelayStub is LightRelay {
    // Gas-reporting version of validateChain
    function validateChainGasReport(bytes memory headers)
        external
        returns (uint256)
    {
        return this.validateChain(headers);
    }
}
