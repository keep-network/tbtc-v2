// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../relay/SparseRelay.sol";

contract SparseRelayStub is SparseRelay {
    using SparseRelayUtils for Chain;

    // Gas-reporting version of validateChain
    function validateGasReport(uint256 ancestorHeight, bytes memory headers)
        external
        returns (bool)
    {
        return this.validate(ancestorHeight, headers);
    }

    // Fill the ring buffer with garbage from ancestorHeight onwards
    function fillBuffer(uint256 ancestorHeight, uint256 positions) external {
        for (uint256 i = 1; i <= positions; i++) {
            chain.addBlock(ancestorHeight + (i * 6), keccak256(abi.encodePacked(i)));
        }
        chain.previousEpochStart = 1;
    }
}
