// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IYearnRegistry {
    function newExperimentalVault(
        address token,
        address governance,
        address guardian,
        address rewards,
        string calldata name,
        string calldata symbol
    ) external returns (address);
}
