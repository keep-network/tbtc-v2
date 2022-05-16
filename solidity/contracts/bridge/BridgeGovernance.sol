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

import "./Bridge.sol";

// TODO: add desc
contract BridgeGovernance is Ownable {
    uint256 public newGovernanceDelay;
    uint256 public governanceDelayChangeInitiated;

    address public newBridgeGovernance;
    uint256 public bridgeGovernanceTransferInitiated;

    uint64 public newDepositDustThreshold;
    uint256 public depositDustThresholdChangeInitiated;

    uint64 public newDepositTreasuryFeeDivisor;
    uint256 public depositTreasuryFeeDivisorChangeInitiated;

    uint64 public newDepositTxMaxFee;
    uint256 public depositTxMaxFeeChangeInitiated;

    uint64 public newRedemptionDustThreshold;
    uint256 public redemptionDustThresholdChangeInitiated;

    uint64 public newRedemptionTreasuryFeeDivisor;
    uint256 public redemptionTreasuryFeeDivisorChangeInitiated;

    Bridge public bridge;

    uint256 public governanceDelay;

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
            block.timestamp - changeInitiatedTimestamp >= governanceDelay,
            "Governance delay has not elapsed"
        );
        _;
        /* solhint-enable not-rely-on-time */
    }

    constructor(Bridge _bridge, uint256 _governanceDelay) {
        bridge = _bridge;
        governanceDelay = _governanceDelay;
    }

    /// @notice Begins the governance delay update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newGovernanceDelay New governance delay
    function beginGovernanceDelayUpdate(uint256 _newGovernanceDelay)
        external
        onlyOwner
    {
        newGovernanceDelay = _newGovernanceDelay;
        /* solhint-disable not-rely-on-time */
        governanceDelayChangeInitiated = block.timestamp;
        emit GovernanceDelayUpdateStarted(_newGovernanceDelay, block.timestamp);
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the governance delay update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeGovernanceDelayUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(governanceDelayChangeInitiated)
    {
        emit GovernanceDelayUpdated(newGovernanceDelay);
        governanceDelay = newGovernanceDelay;
        governanceDelayChangeInitiated = 0;
        newGovernanceDelay = 0;
    }

    /// @notice Begins the Bridge governance transfer process.
    /// @dev Can be called only by the contract owner.
    function beginBridgeGovernanceTransfer(address _newBridgeGovernance)
        external
        onlyOwner
    {
        require(
            address(_newBridgeGovernance) != address(0),
            "New bridge owner address cannot be zero"
        );
        newBridgeGovernance = _newBridgeGovernance;
        /* solhint-disable not-rely-on-time */
        bridgeGovernanceTransferInitiated = block.timestamp;
        emit BridgeGovernanceTransferStarted(
            _newBridgeGovernance,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the bridge governance transfer process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeBridgeGovernanceTransfer()
        external
        onlyOwner
        onlyAfterGovernanceDelay(bridgeGovernanceTransferInitiated)
    {
        emit BridgeGovernanceTransferred(newBridgeGovernance);
        // slither-disable-next-line reentrancy-no-eth
        bridge.transferGovernance(newBridgeGovernance);
        bridgeGovernanceTransferInitiated = 0;
        newBridgeGovernance = address(0);
    }

    /// @notice Begins the deposit dust threshold amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositDustThreshold New deposit dust threshold amount.
    function beginDepositDustThresholdUpdate(uint64 _newDepositDustThreshold)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newDepositDustThreshold = _newDepositDustThreshold;
        depositDustThresholdChangeInitiated = block.timestamp;
        emit DepositDustThresholdUpdateStarted(
            _newDepositDustThreshold,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the deposit dust threshold amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositDustThresholdUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(depositDustThresholdChangeInitiated)
    {
        emit DepositDustThresholdUpdated(newDepositDustThreshold);
        (, uint64 depositTreasuryFeeDivisor, uint64 depositTxMaxFee) = bridge
            .depositParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateDepositParameters(
            newDepositDustThreshold,
            depositTreasuryFeeDivisor,
            depositTxMaxFee
        );
        newDepositDustThreshold = 0;
        depositDustThresholdChangeInitiated = 0;
    }

    /// @notice Begins the deposit treasury fee divisor update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositTreasuryFeeDivisor New deposit treasury fee divisor.
    function beginDepositTreasuryFeeDivisorUpdate(
        uint64 _newDepositTreasuryFeeDivisor
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newDepositTreasuryFeeDivisor = _newDepositTreasuryFeeDivisor;
        depositTreasuryFeeDivisorChangeInitiated = block.timestamp;
        emit DepositTreasuryFeeDivisorUpdateStarted(
            _newDepositTreasuryFeeDivisor,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the deposit treasury fee divisor update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositTreasuryFeeDivisorUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(depositTreasuryFeeDivisorChangeInitiated)
    {
        emit DepositTreasuryFeeDivisorUpdated(newDepositTreasuryFeeDivisor);
        (uint64 depositDustThreshold, , uint64 depositTxMaxFee) = bridge
            .depositParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateDepositParameters(
            depositDustThreshold,
            newDepositTreasuryFeeDivisor,
            depositTxMaxFee
        );
        newDepositTreasuryFeeDivisor = 0;
        depositTreasuryFeeDivisorChangeInitiated = 0;
    }

    /// @notice Begins the deposit tx max fee update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositTxMaxFee New deposit tx max fee.
    function beginDepositTxMaxFeeUpdate(uint64 _newDepositTxMaxFee)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newDepositTxMaxFee = _newDepositTxMaxFee;
        depositTxMaxFeeChangeInitiated = block.timestamp;
        emit DepositTxMaxFeeUpdateStarted(_newDepositTxMaxFee, block.timestamp);
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the deposit tx max fee update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositTxMaxFeeUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(depositTxMaxFeeChangeInitiated)
    {
        emit DepositTxMaxFeeUpdated(newDepositTxMaxFee);
        (
            uint64 depositDustThreshold,
            uint64 depositTreasuryFeeDivisor,

        ) = bridge.depositParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateDepositParameters(
            depositDustThreshold,
            depositTreasuryFeeDivisor,
            newDepositTxMaxFee
        );
        newDepositTxMaxFee = 0;
        depositTxMaxFeeChangeInitiated = 0;
    }

    /// @notice Begins the redemption dust threshold update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionDustThreshold New redemption dust threshold.
    function beginRedemptionDustThresholdUpdate(
        uint64 _newRedemptionDustThreshold
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newRedemptionDustThreshold = _newRedemptionDustThreshold;
        redemptionDustThresholdChangeInitiated = block.timestamp;
        emit RedemptionDustThresholdUpdateStarted(
            _newRedemptionDustThreshold,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the redemption dust threshold update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionDustThresholdUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(redemptionDustThresholdChangeInitiated)
    {
        emit RedemptionDustThresholdUpdated(newRedemptionDustThreshold);
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
            newRedemptionDustThreshold,
            redemptionTreasuryFeeDivisor,
            redemptionTxMaxFee,
            redemptionTimeout,
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );
        newRedemptionDustThreshold = 0;
        redemptionDustThresholdChangeInitiated = 0;
    }

    /// @notice Begins the redemption treasury fee divisor update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTreasuryFeeDivisor New redemption treasury fee divisor.
    function beginRedemptionTreasuryFeeDivisorUpdate(
        uint64 _newRedemptionTreasuryFeeDivisor
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newRedemptionTreasuryFeeDivisor = _newRedemptionTreasuryFeeDivisor;
        redemptionTreasuryFeeDivisorChangeInitiated = block.timestamp;
        emit RedemptionTreasuryFeeDivisorUpdateStarted(
            _newRedemptionTreasuryFeeDivisor,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the redemption treasury fee divisor update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTreasuryFeeDivisorUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(redemptionTreasuryFeeDivisorChangeInitiated)
    {
        emit RedemptionTreasuryFeeDivisorUpdated(
            newRedemptionTreasuryFeeDivisor
        );
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
            newRedemptionTreasuryFeeDivisor,
            redemptionTxMaxFee,
            redemptionTimeout,
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );
        newRedemptionTreasuryFeeDivisor = 0;
        redemptionTreasuryFeeDivisorChangeInitiated = 0;
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
        return getRemainingChangeTime(governanceDelayChangeInitiated);
    }

    /// @notice Get the time remaining until the bridge governance transfer can
    ///         be updated.
    /// @return Remaining time in seconds.
    function getRemainingBridgeGovernanceTransferDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return getRemainingChangeTime(bridgeGovernanceTransferInitiated);
    }

    /// @notice Get the time deposit dust threshold can be updated.
    /// @return Remaining time in seconds.
    function getRemainingDepositDustThresholdDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return getRemainingChangeTime(depositDustThresholdChangeInitiated);
    }

    /// @notice Get the time deposit treasury fee divisor can be updated.
    /// @return Remaining time in seconds.
    function getRemainingDepositTreasuryFeeDivisorDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return getRemainingChangeTime(depositTreasuryFeeDivisorChangeInitiated);
    }

    /// @notice Get the time deposit tx max fee can be updated.
    /// @return Remaining time in seconds.
    function getRemainingDepositTxMaxFeeDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return getRemainingChangeTime(depositTxMaxFeeChangeInitiated);
    }

    /// @notice Get the time redemption dust threshold can be updated.
    /// @return Remaining time in seconds.
    function getRemainingRedemptionDustThresholdDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return getRemainingChangeTime(redemptionDustThresholdChangeInitiated);
    }

    /// @notice Get the time redemption treasury fee divisor can be updated.
    /// @return Remaining time in seconds.
    function getRemainingRedemptionTreasuryFeeDivisorDelayUpdateTime()
        external
        view
        returns (uint256)
    {
        return
            getRemainingChangeTime(redemptionTreasuryFeeDivisorChangeInitiated);
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
        if (elapsed >= governanceDelay) {
            return 0;
        }

        return governanceDelay - elapsed;
    }
}
