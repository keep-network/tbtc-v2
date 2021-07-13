// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IYearnVault {
    function name() external view returns (string calldata);

    function addStrategy(
        address strategy,
        uint256 debtRatio,
        uint256 minDebtPerHarvest,
        uint256 maxDebtPerHarvest,
        uint256 performanceFee
    ) external;

    function strategies(address strategy)
        external
        view
        returns (
            uint256 performanceFee,
            uint256 activation,
            uint256 debtRatio,
            uint256 minDebtPerHarvest,
            uint256 maxDebtPerHarvest,
            uint256 lastReport,
            uint256 totalDebt,
            uint256 totalGain,
            uint256 totalLoss
        );

    function deposit(uint256 amount) external returns (uint256);

    function withdraw() external returns (uint256);

    function totalAssets() external view returns (uint256);

    function setDepositLimit(uint256 limit) external;

    function totalSupply() external view returns (uint256);

    function pricePerShare() external view returns (uint256);
}
