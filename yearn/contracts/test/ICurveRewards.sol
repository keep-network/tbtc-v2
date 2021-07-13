// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface ICurveRewards {
    function notifyRewardAmount(uint256 amount) external;

    function setRewardDistribution(address rewardDistribution) external;
}