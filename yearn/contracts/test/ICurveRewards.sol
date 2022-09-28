// SPDX-License-Identifier: GPL-3.0-only

pragma solidity 0.6.12;

interface ICurveRewards {
    function notifyRewardAmount(uint256 amount) external;

    function setRewardDistribution(address rewardDistribution) external;
}
