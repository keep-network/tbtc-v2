// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IYearnRegistry {
    function newExperimentalVault(
        address token,
        address governance,
        address guardian,
        address rewards,
        string calldata name,
        string calldata symbol,
        uint256 releaseDelta
    ) external returns (address);

    function numReleases() external view returns (uint256);
}
