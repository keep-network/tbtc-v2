// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../bridge/Bridge.sol";

contract TestRelay is IRelay {
    uint256 private currentEpochDifficulty;
    uint256 private prevEpochDifficulty;

    function setCurrentEpochDifficulty(uint256 _difficulty) external {
        currentEpochDifficulty = _difficulty;
    }

    function setPrevEpochDifficulty(uint256 _difficulty) external {
        prevEpochDifficulty = _difficulty;
    }

    function getCurrentEpochDifficulty()
        external
        view
        override
        returns (uint256)
    {
        return currentEpochDifficulty;
    }

    function getPrevEpochDifficulty() external view override returns (uint256) {
        return prevEpochDifficulty;
    }
}
