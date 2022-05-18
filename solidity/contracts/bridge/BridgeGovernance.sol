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
    Bridge internal bridge;
    uint256 public governanceDelay;

    uint256 public newGovernanceDelay;
    uint256 internal governanceDelayChangeInitiated;
    address public newBridgeGovernance;
    uint256 internal bridgeGovernanceTransferChangeInitiated;
    uint64 public newDepositDustThreshold;
    uint256 internal depositDustThresholdChangeInitiated;
    uint64 public newDepositTreasuryFeeDivisor;
    uint256 internal depositTreasuryFeeDivisorChangeInitiated;
    uint64 public newDepositTxMaxFee;
    uint256 internal depositTxMaxFeeChangeInitiated;
    uint64 public newRedemptionDustThreshold;
    uint256 internal redemptionDustThresholdChangeInitiated;
    uint64 public newRedemptionTreasuryFeeDivisor;
    uint256 internal redemptionTreasuryFeeDivisorChangeInitiated;
    uint64 public newRedemptionTxMaxFee;
    uint256 internal redemptionTxMaxFeeChangeInitiated;
    uint64 public newRedemptionTimeout;
    uint256 internal redemptionTimeoutChangeInitiated;
    uint64 public newRedemptionTimeoutSlashingAmount;
    uint256 internal redemptionTimeoutSlashingAmountChangeInitiated;
    uint64 public newRedemptionTimeoutNotifierRewardMultiplier;
    uint256 internal redemptionTimeoutNotifierRewardMultiplierChangeInitiated;
    uint64 public newMovingFundsTxMaxTotalFee;
    uint256 internal movingFundsTxMaxTotalFeeChangeInitiated;
    uint64 public newMovingFundsDustThreshold;
    uint256 internal movingFundsDustThresholdChangeInitiated;
    uint32 public newMovingFundsTimeoutResetDelay;
    uint256 internal movingFundsTimeoutResetDelayChangeInitiated;

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
        uint64 depositTreasuryFeeDivisor,
        uint256 timestamp
    );
    event DepositTreasuryFeeDivisorUpdated(uint64 depositTreasuryFeeDivisor);

    event DepositTxMaxFeeUpdateStarted(
        uint64 newDepositTxMaxFee,
        uint256 timestamp
    );
    event DepositTxMaxFeeUpdated(uint64 depositTxMaxFee);

    event RedemptionDustThresholdUpdateStarted(
        uint64 newRedemptionDustThreshold,
        uint256 timestamp
    );
    event RedemptionDustThresholdUpdated(uint64 redemptionDustThreshold);

    event RedemptionTreasuryFeeDivisorUpdateStarted(
        uint64 newRedemptionTreasuryFeeDivisor,
        uint256 timestamp
    );
    event RedemptionTreasuryFeeDivisorUpdated(
        uint64 redemptionTreasuryFeeDivisor
    );

    event RedemptionTxMaxFeeUpdateStarted(
        uint64 newRedemptionTxMaxFee,
        uint256 timestamp
    );
    event RedemptionTxMaxFeeUpdated(uint64 redemptionTxMaxFee);

    event RedemptionTimeoutUpdateStarted(
        uint64 newRedemptionTimeout,
        uint256 timestamp
    );
    event RedemptionTimeoutUpdated(uint64 redemptionTimeoutSlashingAmount);

    event RedemptionTimeoutSlashingAmountUpdateStarted(
        uint96 newRedemptionTimeoutSlashingAmount,
        uint256 timestamp
    );
    event RedemptionTimeoutSlashingAmountUpdated(
        uint96 redemptionTimeoutSlashingAmount
    );

    event RedemptionTimeoutNotifierRewardMultiplierUpdateStarted(
        uint64 newRedemptionTimeoutNotifierRewardMultiplier,
        uint256 timestamp
    );
    event RedemptionTimeoutNotifierRewardMultiplierUpdated(
        uint64 redemptionTimeoutNotifierRewardMultiplier
    );

    event MovingFundsTxMaxTotalFeeUpdateStarted(
        uint64 newMovingFundsTxMaxTotalFeeThreshold,
        uint256 timestamp
    );
    event MovingFundsTxMaxTotalFeeUpdated(uint64 movingFundsTxMaxTotalFee);

    event MovingFundsDustThresholdUpdateStarted(
        uint64 newMovingFundsDustThresholdThreshold,
        uint256 timestamp
    );
    event MovingFundsDustThresholdUpdated(uint64 movingFundsDustThreshold);

    event MovingFundsTimeoutResetDelayUpdateStarted(
        uint32 newMovingFundsTimeoutResetDelayThreshold,
        uint256 timestamp
    );
    event MovingFundsTimeoutResetDelayUpdated(
        uint64 movingFundsTimeoutResetDelay
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
        bridgeGovernanceTransferChangeInitiated = block.timestamp;
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
        onlyAfterGovernanceDelay(bridgeGovernanceTransferChangeInitiated)
    {
        bridge.transferGovernance(newBridgeGovernance);
        emit BridgeGovernanceTransferred(newBridgeGovernance);
        bridgeGovernanceTransferChangeInitiated = 0;
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
        (, uint64 depositTreasuryFeeDivisor, uint64 depositTxMaxFee) = bridge
            .depositParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateDepositParameters(
            newDepositDustThreshold,
            depositTreasuryFeeDivisor,
            depositTxMaxFee
        );
        emit DepositDustThresholdUpdated(newDepositDustThreshold);

        newDepositDustThreshold = 0;
        depositDustThresholdChangeInitiated = 0;
    }

    /// @notice Begins the deposit treasury fee divisor amount update process.
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

    /// @notice Finalizes the deposit treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositTreasuryFeeDivisorUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(depositTreasuryFeeDivisorChangeInitiated)
    {
        (uint64 depositDustThreshold, , uint64 depositTxMaxFee) = bridge
            .depositParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateDepositParameters(
            depositDustThreshold,
            newDepositTreasuryFeeDivisor,
            depositTxMaxFee
        );
        emit DepositTreasuryFeeDivisorUpdated(newDepositTreasuryFeeDivisor);

        newDepositTreasuryFeeDivisor = 0;
        depositTreasuryFeeDivisorChangeInitiated = 0;
    }

    /// @notice Begins the deposit tx max fee amount update process.
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

    /// @notice Finalizes the deposit tx max fee amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositTxMaxFeeUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(depositTxMaxFeeChangeInitiated)
    {
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

        emit DepositTxMaxFeeUpdated(newDepositTxMaxFee);

        newDepositTxMaxFee = 0;
        depositTxMaxFeeChangeInitiated = 0;
    }

    /// @notice Begins the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionDustThreshold New redemption treasury fee divisor.
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

    /// @notice Finalizes the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionDustThresholdUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(redemptionDustThresholdChangeInitiated)
    {
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
        emit RedemptionDustThresholdUpdated(newRedemptionDustThreshold);

        newRedemptionDustThreshold = 0;
        redemptionDustThresholdChangeInitiated = 0;
    }

    /// @notice Begins the redemption treasury fee divisor amount update process.
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

    /// @notice Finalizes the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTreasuryFeeDivisorUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(redemptionTreasuryFeeDivisorChangeInitiated)
    {
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
        emit RedemptionTreasuryFeeDivisorUpdated(
            newRedemptionTreasuryFeeDivisor
        );

        newRedemptionTreasuryFeeDivisor = 0;
        redemptionTreasuryFeeDivisorChangeInitiated = 0;
    }

    /// @notice Begins the redemption tx max fee amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTxMaxFee New redemption tx max fee.
    function beginRedemptionTxMaxFeeUpdate(uint64 _newRedemptionTxMaxFee)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newRedemptionTxMaxFee = _newRedemptionTxMaxFee;
        redemptionTxMaxFeeChangeInitiated = block.timestamp;
        emit RedemptionTxMaxFeeUpdateStarted(
            _newRedemptionTxMaxFee,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the redemption tx max fee amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTxMaxFeeUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(redemptionTxMaxFeeChangeInitiated)
    {
        (
            uint64 redemptionDustThreshold,
            uint64 redemptionTreasuryFeeDivisor,
            ,
            uint256 redemptionTimeout,
            uint96 redemptionTimeoutSlashingAmount,
            uint256 redemptionTimeoutNotifierRewardMultiplier
        ) = bridge.redemptionParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateRedemptionParameters(
            redemptionDustThreshold,
            redemptionTreasuryFeeDivisor,
            newRedemptionTxMaxFee,
            redemptionTimeout,
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );
        emit RedemptionTxMaxFeeUpdated(newRedemptionTxMaxFee);

        newRedemptionTxMaxFee = 0;
        redemptionTxMaxFeeChangeInitiated = 0;
    }

    /// @notice Begins the redemption timeout amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTimeout New redemption timeout.
    function beginRedemptionTimeoutUpdate(uint64 _newRedemptionTimeout)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newRedemptionTimeout = _newRedemptionTimeout;
        redemptionTimeoutChangeInitiated = block.timestamp;
        emit RedemptionTimeoutUpdateStarted(
            _newRedemptionTimeout,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the redemption timeout amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTimeoutUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(redemptionTimeoutChangeInitiated)
    {
        (
            uint64 redemptionDustThreshold,
            uint64 redemptionTreasuryFeeDivisor,
            uint64 redemptionTxMaxFee,
            ,
            uint96 redemptionTimeoutSlashingAmount,
            uint256 redemptionTimeoutNotifierRewardMultiplier
        ) = bridge.redemptionParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateRedemptionParameters(
            redemptionDustThreshold,
            redemptionTreasuryFeeDivisor,
            redemptionTxMaxFee,
            newRedemptionTimeout,
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );
        emit RedemptionTimeoutUpdated(newRedemptionTimeout);

        newRedemptionTimeout = 0;
        redemptionTimeoutChangeInitiated = 0;
    }

    /// @notice Begins the redemption timeout slashing amount amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTimeoutSlashingAmount New redemption timeout slashing amount.
    function beginRedemptionTimeoutSlashingAmountUpdate(
        uint64 _newRedemptionTimeoutSlashingAmount
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newRedemptionTimeoutSlashingAmount = _newRedemptionTimeoutSlashingAmount;
        redemptionTimeoutSlashingAmountChangeInitiated = block.timestamp;
        emit RedemptionTimeoutSlashingAmountUpdateStarted(
            _newRedemptionTimeoutSlashingAmount,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the redemption timeout slashing amount amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTimeoutSlashingAmountUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(redemptionTimeoutSlashingAmountChangeInitiated)
    {
        (
            uint64 redemptionDustThreshold,
            uint64 redemptionTreasuryFeeDivisor,
            uint64 redemptionTxMaxFee,
            uint256 redemptionTimeout,
            ,
            uint256 redemptionTimeoutNotifierRewardMultiplier
        ) = bridge.redemptionParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateRedemptionParameters(
            redemptionDustThreshold,
            redemptionTreasuryFeeDivisor,
            redemptionTxMaxFee,
            redemptionTimeout,
            newRedemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );
        emit RedemptionTimeoutSlashingAmountUpdated(
            newRedemptionTimeoutSlashingAmount
        );

        newRedemptionTimeoutSlashingAmount = 0;
        redemptionTimeoutSlashingAmountChangeInitiated = 0;
    }

    /// @notice Begins the redemption timeout notifier reward multiplier amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTimeoutNotifierRewardMultiplier New redemption timeout notifier reward multiplier.
    function beginRedemptionTimeoutNotifierRewardMultiplierUpdate(
        uint64 _newRedemptionTimeoutNotifierRewardMultiplier
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newRedemptionTimeoutNotifierRewardMultiplier = _newRedemptionTimeoutNotifierRewardMultiplier;
        redemptionTimeoutNotifierRewardMultiplierChangeInitiated = block
            .timestamp;
        emit RedemptionTimeoutNotifierRewardMultiplierUpdateStarted(
            _newRedemptionTimeoutNotifierRewardMultiplier,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the redemption timeout notifier reward multiplier amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTimeoutNotifierRewardMultiplierUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(
            redemptionTimeoutNotifierRewardMultiplierChangeInitiated
        )
    {
        (
            uint64 redemptionDustThreshold,
            uint64 redemptionTreasuryFeeDivisor,
            uint64 redemptionTxMaxFee,
            uint256 redemptionTimeout,
            uint96 redemptionTimeoutSlashingAmount,

        ) = bridge.redemptionParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateRedemptionParameters(
            redemptionDustThreshold,
            redemptionTreasuryFeeDivisor,
            redemptionTxMaxFee,
            redemptionTimeout,
            redemptionTimeoutSlashingAmount,
            newRedemptionTimeoutNotifierRewardMultiplier
        );
        emit RedemptionTimeoutNotifierRewardMultiplierUpdated(
            newRedemptionTimeoutNotifierRewardMultiplier
        );

        newRedemptionTimeoutNotifierRewardMultiplier = 0;
        redemptionTimeoutNotifierRewardMultiplierChangeInitiated = 0;
    }

    /// @notice Begins the moving funds tx max total fee update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTxMaxTotalFee New moving funds tx max total fee.
    function beginMovingFundsTxMaxTotalFeeUpdate(
        uint64 _newMovingFundsTxMaxTotalFee
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newMovingFundsTxMaxTotalFee = _newMovingFundsTxMaxTotalFee;
        movingFundsTxMaxTotalFeeChangeInitiated = block.timestamp;
        emit MovingFundsTxMaxTotalFeeUpdateStarted(
            _newMovingFundsTxMaxTotalFee,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moving funds tx max total fee update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTxMaxTotalFeeUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(movingFundsTxMaxTotalFeeChangeInitiated)
    {
        emit MovingFundsTxMaxTotalFeeUpdated(newMovingFundsTxMaxTotalFee);
        (
            ,
            uint64 movingFundsDustThreshold,
            uint32 movingFundsTimeoutResetDelay,
            uint32 movingFundsTimeout,
            uint96 movingFundsTimeoutSlashingAmount,
            uint256 movingFundsTimeoutNotifierRewardMultiplier,
            uint64 movedFundsSweepTxMaxTotalFee,
            uint32 movedFundsSweepTimeout,
            uint96 movedFundsSweepTimeoutSlashingAmount,
            uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
        ) = bridge.movingFundsParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateMovingFundsParameters(
            newMovingFundsTxMaxTotalFee,
            movingFundsDustThreshold,
            movingFundsTimeoutResetDelay,
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovingFundsTxMaxTotalFee = 0;
        movingFundsTxMaxTotalFeeChangeInitiated = 0;
    }

    /// @notice Begins the moving funds dust threshold update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsDustThreshold New moving funds dust threshold.
    function beginMovingFundsDustThresholdUpdate(
        uint64 _newMovingFundsDustThreshold
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newMovingFundsDustThreshold = _newMovingFundsDustThreshold;
        movingFundsDustThresholdChangeInitiated = block.timestamp;
        emit MovingFundsDustThresholdUpdateStarted(
            _newMovingFundsDustThreshold,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moving funds dust threshold update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsDustThresholdUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(movingFundsDustThresholdChangeInitiated)
    {
        emit MovingFundsDustThresholdUpdated(newMovingFundsDustThreshold);
        (
            uint64 movingFundsTxMaxTotalFee,
            ,
            uint32 movingFundsTimeoutResetDelay,
            uint32 movingFundsTimeout,
            uint96 movingFundsTimeoutSlashingAmount,
            uint256 movingFundsTimeoutNotifierRewardMultiplier,
            uint64 movedFundsSweepTxMaxTotalFee,
            uint32 movedFundsSweepTimeout,
            uint96 movedFundsSweepTimeoutSlashingAmount,
            uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
        ) = bridge.movingFundsParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateMovingFundsParameters(
            movingFundsTxMaxTotalFee,
            newMovingFundsDustThreshold,
            movingFundsTimeoutResetDelay,
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovingFundsDustThreshold = 0;
        movingFundsDustThresholdChangeInitiated = 0;
    }

    /// @notice Begins the moving funds timeout reset delay update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTimeoutResetDelay New moving funds timeout reset delay.
    function beginMovingFundsTimeoutResetDelayUpdate(
        uint32 _newMovingFundsTimeoutResetDelay
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newMovingFundsTimeoutResetDelay = _newMovingFundsTimeoutResetDelay;
        movingFundsTimeoutResetDelayChangeInitiated = block.timestamp;
        emit MovingFundsTimeoutResetDelayUpdateStarted(
            _newMovingFundsTimeoutResetDelay,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moving funds timeout reset delay update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTimeoutResetDelayUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(movingFundsTimeoutResetDelayChangeInitiated)
    {
        emit MovingFundsTimeoutResetDelayUpdated(
            newMovingFundsTimeoutResetDelay
        );
        (
            uint64 movingFundsTxMaxTotalFee,
            uint64 movingFundsDustThreshold,
            ,
            uint32 movingFundsTimeout,
            uint96 movingFundsTimeoutSlashingAmount,
            uint256 movingFundsTimeoutNotifierRewardMultiplier,
            uint64 movedFundsSweepTxMaxTotalFee,
            uint32 movedFundsSweepTimeout,
            uint96 movedFundsSweepTimeoutSlashingAmount,
            uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
        ) = bridge.movingFundsParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateMovingFundsParameters(
            movingFundsTxMaxTotalFee,
            movingFundsDustThreshold,
            newMovingFundsTimeoutResetDelay,
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovingFundsTimeoutResetDelay = 0;
        movingFundsTimeoutResetDelayChangeInitiated = 0;
    }

    // TODO add:

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
        return getRemainingChangeTime(bridgeGovernanceTransferChangeInitiated);
    }

    // TODO: add more params here
    function getChangeInitiatedParams()
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            governanceDelayChangeInitiated,
            bridgeGovernanceTransferChangeInitiated,
            depositDustThresholdChangeInitiated,
            depositTreasuryFeeDivisorChangeInitiated,
            depositTxMaxFeeChangeInitiated,
            redemptionDustThresholdChangeInitiated,
            redemptionTreasuryFeeDivisorChangeInitiated,
            redemptionTxMaxFeeChangeInitiated,
            redemptionTimeoutChangeInitiated,
            redemptionTimeoutSlashingAmountChangeInitiated,
            redemptionTimeoutNotifierRewardMultiplierChangeInitiated,
            movingFundsTxMaxTotalFeeChangeInitiated
        );
    }

    function getRemainingDepositParamsUpdateTime()
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (
            getRemainingChangeTime(depositDustThresholdChangeInitiated),
            getRemainingChangeTime(depositTreasuryFeeDivisorChangeInitiated),
            getRemainingChangeTime(depositTxMaxFeeChangeInitiated)
        );
    }

    function getRemainingRedemptionParamsUpdateTime()
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            getRemainingChangeTime(redemptionDustThresholdChangeInitiated),
            getRemainingChangeTime(redemptionTreasuryFeeDivisorChangeInitiated),
            getRemainingChangeTime(redemptionTxMaxFeeChangeInitiated),
            getRemainingChangeTime(redemptionTimeoutChangeInitiated),
            getRemainingChangeTime(
                redemptionTimeoutSlashingAmountChangeInitiated
            ),
            getRemainingChangeTime(
                redemptionTimeoutNotifierRewardMultiplierChangeInitiated
            )
        );
    }

    // TODO: uncomment after all the moving params are added
    // function getRemainingMovingFundsParamsUpdateTime() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256) {
    //     return (
    //         getRemainingChangeTime(movingFundsTxMaxTotalFeeChangeInitiated),
    //         getRemainingChangeTime(movingFundsDustThresholdChangeInitiated),
    //         getRemainingChangeTime(movingFundsTimeoutResetDelayChangeInitiated),
    //         getRemainingChangeTime(movingFundsTimeoutChangeInitiated),
    //         getRemainingChangeTime(movingFundsTimeoutSlashingAmountChangeInitiated),
    //         getRemainingChangeTime(movingFundsTimeoutNotifierRewardMultiplierChangeInitiated),
    //         getRemainingChangeTime(movedFundsSweepTxMaxTotalFeeChangeInitiated),
    //         getRemainingChangeTime(movedFundsSweepTimeoutChangeInitiated),
    //         getRemainingChangeTime(movedFundsSweepTimeoutSlashingAmountChangeInitiated),
    //         getRemainingChangeTime(movedFundsSweepTimeoutNotifierRewardMultiplierChangeInitiated),
    //     );
    // }

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
