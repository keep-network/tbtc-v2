// SPDX-License-Identifier: MIT

// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BridgeGovernanceParams.sol";

import "./Bridge.sol";

// TODO: add desc
contract BridgeGovernance is Ownable {
    using BridgeGovernanceParams for BridgeGovernanceParams.Data;

    BridgeGovernanceParams.Data internal bridgeGovernanceParams;

    Bridge public bridge;

    event GovernanceDelayUpdateStarted(
        uint256 governanceDelay,
        uint256 timestamp
    );
    event GovernanceDelayUpdated(uint256 governanceDelay);

    event BridgeGovernanceTransferStarted(
        address newBridgeGovernance,
        uint256 timestamp
    );
    event BridgeGovernanceTransferred(address newBridgeGovernance);

    event DepositDustThresholdUpdateStarted(
        uint64 newDepositDustThreshold,
        uint256 timestamp
    );
    event DepositDustThresholdUpdated(uint64 depositDustThreshold);

    event DepositTreasuryFeeDivisorUpdateStarted(
        uint64 newDepositTreasuryFeeDivisorThreshold,
        uint256 timestamp
    );
    event DepositTreasuryFeeDivisorUpdated(uint64 depositTreasuryFeeDivisor);

    event DepositTxMaxFeeUpdateStarted(
        uint64 newDepositTxMaxFeeThreshold,
        uint256 timestamp
    );
    event DepositTxMaxFeeUpdated(uint64 depositTxMaxFee);

    event RedemptionDustThresholdUpdateStarted(
        uint64 newRedemptionDustThresholdThreshold,
        uint256 timestamp
    );
    event RedemptionDustThresholdUpdated(uint64 redemptionDustThreshold);

    event RedemptionTreasuryFeeDivisorUpdateStarted(
        uint64 redemptionTreasuryFeeDivisor,
        uint256 timestamp
    );
    event RedemptionTreasuryFeeDivisorUpdated(
        uint64 redemptionTreasuryFeeDivisor
    );

    /// @notice Reverts if called before the governance delay elapses.
    /// @param changeInitiatedTimestamp Timestamp indicating the beginning
    ///        of the change.
    modifier onlyAfterGovernanceDelay(uint256 changeInitiatedTimestamp) {
        /* solhint-disable not-rely-on-time */
        require(changeInitiatedTimestamp > 0, "Change not initiated");
        require(
            block.timestamp - changeInitiatedTimestamp >=
                bridgeGovernanceParams.getGovernanceDelay(),
            "Governance delay has not elapsed"
        );
        _;
        /* solhint-enable not-rely-on-time */
    }

    constructor(Bridge _bridge, uint256 _governanceDelay) {
        bridge = _bridge;
        bridgeGovernanceParams.init(_governanceDelay);
    }

    /// @notice Begins the governance delay update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newGovernanceDelay New governance delay
    function beginGovernanceDelayUpdate(uint256 _newGovernanceDelay)
        external
        onlyOwner
    {
        bridgeGovernanceParams.beginGovernanceDelayUpdate(_newGovernanceDelay);
    }

    /// @notice Finalizes the governance delay update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeGovernanceDelayUpdate() external onlyOwner {
        bridgeGovernanceParams.finalizeGovernanceDelayUpdate();
    }

    /// @notice Begins the Bridge governance transfer process.
    /// @dev Can be called only by the contract owner.
    function beginBridgeGovernanceTransfer(address _newBridgeGovernance)
        external
        onlyOwner
    {
        bridgeGovernanceParams.beginBridgeGovernanceTransfer(
            _newBridgeGovernance
        );
    }

    /// @notice Finalizes the bridge governance transfer process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeBridgeGovernanceTransfer() external onlyOwner {
        bridge.transferGovernance(
            bridgeGovernanceParams.getNewBridgeGovernance()
        );
        bridgeGovernanceParams.finalizeBridgeGovernanceTransfer();
    }

    /// @notice Begins the deposit dust threshold amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositDustThreshold New deposit dust threshold amount.
    function beginDepositDustThresholdUpdate(uint64 _newDepositDustThreshold)
        external
        onlyOwner
    {
        bridgeGovernanceParams.beginDepositDustThresholdUpdate(
            _newDepositDustThreshold
        );
    }

    /// @notice Finalizes the deposit dust threshold amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositDustThresholdUpdate() external onlyOwner {
        (, uint64 depositTreasuryFeeDivisor, uint64 depositTxMaxFee) = bridge
            .depositParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateDepositParameters(
            bridgeGovernanceParams.getNewDepositDustThreshold(),
            depositTreasuryFeeDivisor,
            depositTxMaxFee
        );
        bridgeGovernanceParams.finalizeDepositDustThresholdUpdate();
    }

    /// @notice Begins the deposit treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositTreasuryFeeDivisor New deposit treasury fee divisor.
    function beginDepositTreasuryFeeDivisorUpdate(
        uint64 _newDepositTreasuryFeeDivisor
    ) external onlyOwner {
        bridgeGovernanceParams.beginDepositTreasuryFeeDivisorUpdate(
            _newDepositTreasuryFeeDivisor
        );
    }

    /// @notice Finalizes the deposit treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositTreasuryFeeDivisorUpdate() external onlyOwner {
        (uint64 depositDustThreshold, , uint64 depositTxMaxFee) = bridge
            .depositParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateDepositParameters(
            depositDustThreshold,
            bridgeGovernanceParams.getNewDepositTreasuryFeeDivisor(),
            depositTxMaxFee
        );
        bridgeGovernanceParams.finalizeDepositTreasuryFeeDivisorUpdate();
    }

    /// @notice Begins the deposit tx max fee amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositTxMaxFee New deposit tx max fee.
    function beginDepositTxMaxFeeUpdate(uint64 _newDepositTxMaxFee)
        external
        onlyOwner
    {
        bridgeGovernanceParams.beginDepositTxMaxFeeUpdate(_newDepositTxMaxFee);
    }

    /// @notice Finalizes the deposit tx max fee amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositTxMaxFeeUpdate() external onlyOwner {
        (
            uint64 depositDustThreshold,
            uint64 depositTreasuryFeeDivisor,

        ) = bridge.depositParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateDepositParameters(
            depositDustThreshold,
            depositTreasuryFeeDivisor,
            bridgeGovernanceParams.getNewDepositTxMaxFee()
        );

        bridgeGovernanceParams.finalizeDepositTxMaxFeeUpdate();
    }

    /// @notice Begins the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionDustThreshold New redemption treasury fee divisor.
    function beginRedemptionDustThresholdUpdate(
        uint64 _newRedemptionDustThreshold
    ) external onlyOwner {
        bridgeGovernanceParams.beginRedemptionDustThresholdUpdate(
            _newRedemptionDustThreshold
        );
    }

    /// @notice Finalizes the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionDustThresholdUpdate() external onlyOwner {
        (
            ,
            uint64 redemptionTreasuryFeeDivisor,
            uint64 redemptionTxMaxFee,
            uint256 redemptionTimeout,
            uint96 redemptionTimeoutSlashingAmount,
            uint256 redemptionTimeoutNotifierRewardMultiplier
        ) = bridge.redemptionParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateRedemptionParameters(
            bridgeGovernanceParams.getNewRedemptionDustThreshold(),
            redemptionTreasuryFeeDivisor,
            redemptionTxMaxFee,
            redemptionTimeout,
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );
        bridgeGovernanceParams.finalizeRedemptionDustThresholdUpdate();
    }

    /// @notice Begins the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTreasuryFeeDivisor New redemption treasury fee divisor.
    function beginRedemptionTreasuryFeeDivisorUpdate(
        uint64 _newRedemptionTreasuryFeeDivisor
    ) external onlyOwner {
        bridgeGovernanceParams.beginRedemptionTreasuryFeeDivisorUpdate(
            _newRedemptionTreasuryFeeDivisor
        );
    }

    /// @notice Finalizes the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTreasuryFeeDivisorUpdate() external onlyOwner {
        (
            uint64 redemptionDustThreshold,
            ,
            uint64 redemptionTxMaxFee,
            uint256 redemptionTimeout,
            uint96 redemptionTimeoutSlashingAmount,
            uint256 redemptionTimeoutNotifierRewardMultiplier
        ) = bridge.redemptionParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateRedemptionParameters(
            redemptionDustThreshold,
            bridgeGovernanceParams.getNewRedemptionTreasuryFeeDivisor(),
            redemptionTxMaxFee,
            redemptionTimeout,
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );
        bridgeGovernanceParams.finalizeRedemptionTreasuryFeeDivisorUpdate();
    }

    // TODO add:
    // uint64 redemptionTxMaxFee,
    // uint256 redemptionTimeout,
    // uint96 redemptionTimeoutSlashingAmount,
    // uint256 redemptionTimeoutNotifierRewardMultiplier

    // uint64 movingFundsTxMaxTotalFee,
    // uint64 movingFundsDustThreshold,
    // uint32 movingFundsTimeoutResetDelay,
    // uint32 movingFundsTimeout,
    // uint96 movingFundsTimeoutSlashingAmount,
    // uint256 movingFundsTimeoutNotifierRewardMultiplier,
    // uint64 movedFundsSweepTxMaxTotalFee,
    // uint32 movedFundsSweepTimeout,
    // uint96 movedFundsSweepTimeoutSlashingAmount,
    // uint256 movedFundsSweepTimeoutNotifierRewardMultiplier

    // uint32 walletCreationPeriod,
    // uint64 walletCreationMinBtcBalance,
    // uint64 walletCreationMaxBtcBalance,
    // uint64 walletClosureMinBtcBalance,
    // uint32 walletMaxAge,
    // uint64 walletMaxBtcTransfer,
    // uint32 walletClosingPeriod

    // uint256 fraudChallengeDepositAmount,
    // uint256 fraudChallengeDefeatTimeout,
    // uint96 fraudSlashingAmount,
    // uint256 fraudNotifierRewardMultiplier

    /// @notice Get the time remaining until the governance delay can
    ///         be updated.
    /// @return Remaining time in seconds.
    function getRemainingGovernanceDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return bridgeGovernanceParams.getRemainingGovernanceDelayUpdateTime();
    }

    function governanceDelay() external view returns (uint256) {
        return bridgeGovernanceParams.getGovernanceDelay();
    }

    /// @notice Get the time remaining until the bridge governance transfer can
    ///         be updated.
    /// @return Remaining time in seconds.
    function getRemainingBridgeGovernanceTransferDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return
            bridgeGovernanceParams
                .getRemainingBridgeGovernanceTransferDelayUpdateTime();
    }

    /// @notice Get the time deposit dust threshold can be updated.
    /// @return Remaining time in seconds.
    function getRemainingDepositDustThresholdDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return
            bridgeGovernanceParams
                .getRemainingDepositDustThresholdDelayUpdateTime();
    }

    /// @notice Get the time deposit treasury fee divisor can be updated.
    /// @return Remaining time in seconds.
    function getRemainingDepositTreasuryFeeDivisorDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return
            bridgeGovernanceParams
                .getRemainingDepositTreasuryFeeDivisorDelayUpdateTime();
    }

    /// @notice Get the time deposit tx max fee can be updated.
    /// @return Remaining time in seconds.
    function getRemainingDepositTxMaxFeeDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return
            bridgeGovernanceParams.getRemainingDepositTxMaxFeeDelayUpdateTime();
    }

    /// @notice Get the time redemption treasury fee divisor can be updated.
    /// @return Remaining time in seconds.
    function getRemainingRedemptionDustThresholdDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return
            bridgeGovernanceParams
                .getRemainingRedemptionDustThresholdDelayUpdateTime();
    }

    /// @notice Get the time redemption treasury fee divisor can be updated.
    /// @return Remaining time in seconds.
    function getRemainingRedemptionTreasuryFeeDivisorDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return
            bridgeGovernanceParams
                .getRemainingRedemptionTreasuryFeeDivisorDelayUpdateTime();
    }

    /// @notice Gets the time remaining until the governable parameter update
    ///         can be committed.
    /// @param changeTimestamp Timestamp indicating the beginning of the change.
    /// @return Remaining time in seconds.
    function getRemainingChangeTime(uint256 changeTimestamp)
        internal
        view
        returns (uint256)
    {
        require(changeTimestamp > 0, "Change not initiated");
        /* solhint-disable-next-line not-rely-on-time */
        uint256 elapsed = block.timestamp - changeTimestamp;
        if (elapsed >= bridgeGovernanceParams.getGovernanceDelay()) {
            return 0;
        }

        return bridgeGovernanceParams.getGovernanceDelay() - elapsed;
    }
}
