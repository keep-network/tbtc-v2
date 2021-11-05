// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IQuickLock {
    function quickLock(address owner, uint256 amount) external;
}
