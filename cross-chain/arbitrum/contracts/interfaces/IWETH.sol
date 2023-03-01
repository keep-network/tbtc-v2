// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

// Copy from https://github.com/wormhole-foundation/wormhole/blob/main/ethereum/contracts/bridge/interfaces/IWETH.sol

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint amount) external;
}
