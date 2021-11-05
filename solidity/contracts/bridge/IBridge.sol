// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IBridge {
    function redeem(
        uint256 amount,
        bytes8 outputValueBytes,
        bytes memory redeemerOutputScript
    ) external;
}
