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
    uint256 public governanceDelayChangeInitiated;
    address public newBridgeGovernance;
    uint256 public bridgeGovernanceTransferChangeInitiated;
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
    uint64 public newRedemptionTxMaxFee;
    uint256 public redemptionTxMaxFeeChangeInitiated;
    uint64 public newRedemptionTimeout;
    uint256 public redemptionTimeoutChangeInitiated;
    uint64 public newRedemptionTimeoutSlashingAmount;
    uint256 public redemptionTimeoutSlashingAmountChangeInitiated;
    uint64 public newRedemptionTimeoutNotifierRewardMultiplier;
    uint256 public redemptionTimeoutNotifierRewardMultiplierChangeInitiated;
    uint64 public newMovingFundsTxMaxTotalFee;
    uint256 public movingFundsTxMaxTotalFeeChangeInitiated;
    uint64 public newMovingFundsDustThreshold;
    uint256 public movingFundsDustThresholdChangeInitiated;
    uint32 public newMovingFundsTimeoutResetDelay;
    uint256 public movingFundsTimeoutResetDelayChangeInitiated;
    uint32 public newMovingFundsTimeout;
    uint256 public movingFundsTimeoutChangeInitiated;
    uint64 public newMovingFundsTimeoutSlashingAmount;
    uint256 public movingFundsTimeoutSlashingAmountChangeInitiated;
    uint256 public newMovingFundsTimeoutNotifierRewardMultiplier;
    uint256 public movingFundsTimeoutNotifierRewardMultiplierChangeInitiated;
    uint64 public newMovedFundsSweepTxMaxTotalFee;
    uint256 public movedFundsSweepTxMaxTotalFeeChangeInitiated;
    uint32 public newMovedFundsSweepTimeout;
    uint256 public movedFundsSweepTimeoutChangeInitiated;
    uint64 public newMovedFundsSweepTimeoutSlashingAmount;
    uint256 public movedFundsSweepTimeoutSlashingAmountChangeInitiated;
    uint64 public newMovedFundsSweepTimeoutNotifierRewardMultiplier;
    uint256
        internal movedFundsSweepTimeoutNotifierRewardMultiplierChangeInitiated;
    uint32 public newWalletCreationPeriod;
    uint256 public walletCreationPeriodChangeInitiated;
    uint64 public newWalletCreationMinBtcBalance;
    uint256 public walletCreationMinBtcBalanceChangeInitiated;
    uint64 public newWalletCreationMaxBtcBalance;
    uint256 public walletCreationMaxBtcBalanceChangeInitiated;
    uint64 public newWalletClosureMinBtcBalance;
    uint256 public walletClosureMinBtcBalanceChangeInitiated;
    uint32 public newWalletMaxAge;
    uint256 public walletMaxAgeChangeInitiated;
    uint64 public newWalletMaxBtcTransfer;
    uint256 public walletMaxBtcTransferChangeInitiated;
    uint32 public newWalletClosingPeriod;
    uint256 public walletClosingPeriodChangeInitiated;
    uint256 public newFraudChallengeDepositAmount;
    uint256 public fraudChallengeDepositAmountChangeInitiated;
    uint256 public newFraudChallengeDefeatTimeout;
    uint256 public fraudChallengeDefeatTimeoutChangeInitiated;
    uint96 public newFraudSlashingAmount;
    uint256 public fraudSlashingAmountChangeInitiated;

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

    event MovingFundsTimeoutUpdateStarted(
        uint64 newMovingFundsTimeoutThreshold,
        uint256 timestamp
    );
    event MovingFundsTimeoutUpdated(uint64 movingFundsTimeout);

    event MovingFundsTimeoutSlashingAmountUpdateStarted(
        uint64 newMovingFundsTimeoutSlashingAmountThreshold,
        uint256 timestamp
    );
    event MovingFundsTimeoutSlashingAmountUpdated(
        uint64 movingFundsTimeoutSlashingAmount
    );

    event MovingFundsTimeoutNotifierRewardMultiplierUpdateStarted(
        uint256 newMovingFundsTimeoutNotifierRewardMultiplierThreshold,
        uint256 timestamp
    );
    event MovingFundsTimeoutNotifierRewardMultiplierUpdated(
        uint256 movingFundsTimeoutNotifierRewardMultiplier
    );

    event MovedFundsSweepTxMaxTotalFeeUpdateStarted(
        uint64 newMovedFundsSweepTxMaxTotalFeeThreshold,
        uint256 timestamp
    );
    event MovedFundsSweepTxMaxTotalFeeUpdated(
        uint64 movedFundsSweepTxMaxTotalFee
    );

    event MovedFundsSweepTimeoutUpdateStarted(
        uint64 newMovedFundsSweepTimeoutThreshold,
        uint256 timestamp
    );
    event MovedFundsSweepTimeoutUpdated(uint64 movedFundsSweepTimeout);

    event MovedFundsSweepTimeoutSlashingAmountUpdateStarted(
        uint64 newMovedFundsSweepTimeoutSlashingAmountThreshold,
        uint256 timestamp
    );
    event MovedFundsSweepTimeoutSlashingAmountUpdated(
        uint64 movedFundsSweepTimeoutSlashingAmount
    );

    event MovedFundsSweepTimeoutNotifierRewardMultiplierUpdateStarted(
        uint64 newMovedFundsSweepTimeoutNotifierRewardMultiplierThreshold,
        uint256 timestamp
    );
    event MovedFundsSweepTimeoutNotifierRewardMultiplierUpdated(
        uint64 movedFundsSweepTimeoutNotifierRewardMultiplier
    );

    event WalletCreationPeriodUpdateStarted(
        uint64 newWalletCreationPeriodThreshold,
        uint256 timestamp
    );
    event WalletCreationPeriodUpdated(uint64 walletCreationPeriod);

    event WalletCreationMinBtcBalanceUpdateStarted(
        uint64 newWalletCreationMinBtcBalanceThreshold,
        uint256 timestamp
    );
    event WalletCreationMinBtcBalanceUpdated(
        uint64 walletCreationMinBtcBalance
    );

    event WalletCreationMaxBtcBalanceUpdateStarted(
        uint64 newWalletCreationMaxBtcBalanceThreshold,
        uint256 timestamp
    );
    event WalletCreationMaxBtcBalanceUpdated(
        uint64 walletCreationMaxBtcBalance
    );

    event WalletClosureMinBtcBalanceUpdateStarted(
        uint64 newWalletClosureMinBtcBalanceThreshold,
        uint256 timestamp
    );
    event WalletClosureMinBtcBalanceUpdated(uint64 walletClosureMinBtcBalance);

    event WalletMaxAgeUpdateStarted(
        uint32 newWalletMaxAgeThreshold,
        uint256 timestamp
    );
    event WalletMaxAgeUpdated(uint32 walletMaxAge);

    event WalletMaxBtcTransferUpdateStarted(
        uint64 newWalletMaxBtcTransferThreshold,
        uint256 timestamp
    );
    event WalletMaxBtcTransferUpdated(uint64 walletMaxBtcTransfer);

    event WalletClosingPeriodUpdateStarted(
        uint32 newWalletClosingPeriodThreshold,
        uint256 timestamp
    );
    event WalletClosingPeriodUpdated(uint32 walletClosingPeriod);

    event FraudChallengeDepositAmountUpdateStarted(
        uint256 newFraudChallengeDepositAmountThreshold,
        uint256 timestamp
    );
    event FraudChallengeDepositAmountUpdated(
        uint256 fraudChallengeDefeatTimeout
    );

    event FraudChallengeDefeatTimeoutUpdateStarted(
        uint256 newFraudChallengeDefeatTimeoutThreshold,
        uint256 timestamp
    );
    event FraudChallengeDefeatTimeoutUpdated(
        uint256 fraudChallengeDefeatTimeout
    );

    event FraudSlashingAmountUpdateStarted(
        uint96 newFraudSlashingAmountThreshold,
        uint256 timestamp
    );
    event FraudSlashingAmountUpdated(uint96 fraudSlashingAmount);

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

    /// @notice Begins the moving funds timeout update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTimeout New moving funds timeout.
    function beginMovingFundsTimeoutUpdate(uint32 _newMovingFundsTimeout)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newMovingFundsTimeout = _newMovingFundsTimeout;
        movingFundsTimeoutChangeInitiated = block.timestamp;
        emit MovingFundsTimeoutUpdateStarted(
            _newMovingFundsTimeout,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moving funds timeout update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTimeoutUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(movingFundsTimeoutChangeInitiated)
    {
        emit MovingFundsTimeoutUpdated(newMovingFundsTimeout);
        (
            uint64 movingFundsTxMaxTotalFee,
            uint64 movingFundsDustThreshold,
            uint32 movingFundsTimeoutResetDelay,
            ,
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
            movingFundsTimeoutResetDelay,
            newMovingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovingFundsTimeout = 0;
        movingFundsTimeoutChangeInitiated = 0;
    }

    /// @notice Begins the moving funds timeout slashing amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTimeoutSlashingAmount New moving funds timeout slashing amount.
    function beginMovingFundsTimeoutSlashingAmountUpdate(
        uint64 _newMovingFundsTimeoutSlashingAmount
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newMovingFundsTimeoutSlashingAmount = _newMovingFundsTimeoutSlashingAmount;
        movingFundsTimeoutSlashingAmountChangeInitiated = block.timestamp;
        emit MovingFundsTimeoutSlashingAmountUpdateStarted(
            _newMovingFundsTimeoutSlashingAmount,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moving funds timeout slashing amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTimeoutSlashingAmountUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(
            movingFundsTimeoutSlashingAmountChangeInitiated
        )
    {
        emit MovingFundsTimeoutSlashingAmountUpdated(
            newMovingFundsTimeoutSlashingAmount
        );
        (
            uint64 movingFundsTxMaxTotalFee,
            uint64 movingFundsDustThreshold,
            uint32 movingFundsTimeoutResetDelay,
            uint32 movingFundsTimeout,
            ,
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
            movingFundsTimeoutResetDelay,
            movingFundsTimeout,
            newMovingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovingFundsTimeoutSlashingAmount = 0;
        movingFundsTimeoutSlashingAmountChangeInitiated = 0;
    }

    /// @notice Begins the moving funds timeout notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTimeoutNotifierRewardMultiplier New moving funds timeout notifier reward multiplier.
    function beginMovingFundsTimeoutNotifierRewardMultiplierUpdate(
        uint64 _newMovingFundsTimeoutNotifierRewardMultiplier
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newMovingFundsTimeoutNotifierRewardMultiplier = _newMovingFundsTimeoutNotifierRewardMultiplier;
        movingFundsTimeoutNotifierRewardMultiplierChangeInitiated = block
            .timestamp;
        emit MovingFundsTimeoutNotifierRewardMultiplierUpdateStarted(
            _newMovingFundsTimeoutNotifierRewardMultiplier,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moving funds timeout notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTimeoutNotifierRewardMultiplierUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(
            movingFundsTimeoutNotifierRewardMultiplierChangeInitiated
        )
    {
        emit MovingFundsTimeoutNotifierRewardMultiplierUpdated(
            newMovingFundsTimeoutNotifierRewardMultiplier
        );
        (
            uint64 movingFundsTxMaxTotalFee,
            uint64 movingFundsDustThreshold,
            uint32 movingFundsTimeoutResetDelay,
            uint32 movingFundsTimeout,
            uint96 movingFundsTimeoutSlashingAmount,
            ,
            uint64 movedFundsSweepTxMaxTotalFee,
            uint32 movedFundsSweepTimeout,
            uint96 movedFundsSweepTimeoutSlashingAmount,
            uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
        ) = bridge.movingFundsParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateMovingFundsParameters(
            movingFundsTxMaxTotalFee,
            movingFundsDustThreshold,
            movingFundsTimeoutResetDelay,
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            newMovingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovingFundsTimeoutNotifierRewardMultiplier = 0;
        movingFundsTimeoutNotifierRewardMultiplierChangeInitiated = 0;
    }

    /// @notice Begins the moved funds sweep tx max total fee update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovedFundsSweepTxMaxTotalFee New moved funds sweep tx max total fee.
    function beginMovedFundsSweepTxMaxTotalFeeUpdate(
        uint64 _newMovedFundsSweepTxMaxTotalFee
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newMovedFundsSweepTxMaxTotalFee = _newMovedFundsSweepTxMaxTotalFee;
        movedFundsSweepTxMaxTotalFeeChangeInitiated = block.timestamp;
        emit MovedFundsSweepTxMaxTotalFeeUpdateStarted(
            _newMovedFundsSweepTxMaxTotalFee,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moved funds sweep tx max total fee update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovedFundsSweepTxMaxTotalFeeUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(movedFundsSweepTxMaxTotalFeeChangeInitiated)
    {
        emit MovedFundsSweepTxMaxTotalFeeUpdated(
            newMovedFundsSweepTxMaxTotalFee
        );
        (
            uint64 movingFundsTxMaxTotalFee,
            uint64 movingFundsDustThreshold,
            uint32 movingFundsTimeoutResetDelay,
            uint32 movingFundsTimeout,
            uint96 movingFundsTimeoutSlashingAmount,
            uint256 movingFundsTimeoutNotifierRewardMultiplier,
            ,
            uint32 movedFundsSweepTimeout,
            uint96 movedFundsSweepTimeoutSlashingAmount,
            uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
        ) = bridge.movingFundsParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateMovingFundsParameters(
            movingFundsTxMaxTotalFee,
            movingFundsDustThreshold,
            movingFundsTimeoutResetDelay,
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            newMovedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovedFundsSweepTxMaxTotalFee = 0;
        movedFundsSweepTxMaxTotalFeeChangeInitiated = 0;
    }

    /// @notice Begins the moved funds sweep timeout update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovedFundsSweepTimeout New moved funds sweep timeout.
    function beginMovedFundsSweepTimeoutUpdate(
        uint32 _newMovedFundsSweepTimeout
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newMovedFundsSweepTimeout = _newMovedFundsSweepTimeout;
        movedFundsSweepTimeoutChangeInitiated = block.timestamp;
        emit MovedFundsSweepTimeoutUpdateStarted(
            _newMovedFundsSweepTimeout,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moved funds sweep timeout update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovedFundsSweepTimeoutUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(movedFundsSweepTimeoutChangeInitiated)
    {
        emit MovedFundsSweepTimeoutUpdated(newMovedFundsSweepTimeout);
        (
            uint64 movingFundsTxMaxTotalFee,
            uint64 movingFundsDustThreshold,
            uint32 movingFundsTimeoutResetDelay,
            uint32 movingFundsTimeout,
            uint96 movingFundsTimeoutSlashingAmount,
            uint256 movingFundsTimeoutNotifierRewardMultiplier,
            uint64 movedFundsSweepTxMaxTotalFee,
            ,
            uint96 movedFundsSweepTimeoutSlashingAmount,
            uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
        ) = bridge.movingFundsParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateMovingFundsParameters(
            movingFundsTxMaxTotalFee,
            movingFundsDustThreshold,
            movingFundsTimeoutResetDelay,
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            newMovedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovedFundsSweepTimeout = 0;
        movedFundsSweepTimeoutChangeInitiated = 0;
    }

    /// @notice Begins the moved funds sweep timeout slashing amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovedFundsSweepTimeoutSlashingAmount New moved funds sweep timeout slashing amount.
    function beginMovedFundsSweepTimeoutSlashingAmountUpdate(
        uint64 _newMovedFundsSweepTimeoutSlashingAmount
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newMovedFundsSweepTimeoutSlashingAmount = _newMovedFundsSweepTimeoutSlashingAmount;
        movedFundsSweepTimeoutSlashingAmountChangeInitiated = block.timestamp;
        emit MovedFundsSweepTimeoutSlashingAmountUpdateStarted(
            _newMovedFundsSweepTimeoutSlashingAmount,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moved funds sweep timeout slashing amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovedFundsSweepTimeoutSlashingAmountUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(
            movedFundsSweepTimeoutSlashingAmountChangeInitiated
        )
    {
        emit MovedFundsSweepTimeoutSlashingAmountUpdated(
            newMovedFundsSweepTimeoutSlashingAmount
        );
        (
            uint64 movingFundsTxMaxTotalFee,
            uint64 movingFundsDustThreshold,
            uint32 movingFundsTimeoutResetDelay,
            uint32 movingFundsTimeout,
            uint96 movingFundsTimeoutSlashingAmount,
            uint256 movingFundsTimeoutNotifierRewardMultiplier,
            uint64 movedFundsSweepTxMaxTotalFee,
            uint32 movedFundsSweepTimeout,
            ,
            uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
        ) = bridge.movingFundsParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateMovingFundsParameters(
            movingFundsTxMaxTotalFee,
            movingFundsDustThreshold,
            movingFundsTimeoutResetDelay,
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            newMovedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovedFundsSweepTimeoutSlashingAmount = 0;
        movedFundsSweepTimeoutSlashingAmountChangeInitiated = 0;
    }

    /// @notice Begins the moved funds sweep timeout notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovedFundsSweepTimeoutNotifierRewardMultiplier New moved funds sweep timeout notifier reward multiplier.
    function beginMovedFundsSweepTimeoutNotifierRewardMultiplierUpdate(
        uint64 _newMovedFundsSweepTimeoutNotifierRewardMultiplier
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newMovedFundsSweepTimeoutNotifierRewardMultiplier = _newMovedFundsSweepTimeoutNotifierRewardMultiplier;
        movedFundsSweepTimeoutNotifierRewardMultiplierChangeInitiated = block
            .timestamp;
        emit MovedFundsSweepTimeoutNotifierRewardMultiplierUpdateStarted(
            _newMovedFundsSweepTimeoutNotifierRewardMultiplier,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the moved funds sweep timeout notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovedFundsSweepTimeoutNotifierRewardMultiplierUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(
            movedFundsSweepTimeoutNotifierRewardMultiplierChangeInitiated
        )
    {
        emit MovedFundsSweepTimeoutNotifierRewardMultiplierUpdated(
            newMovedFundsSweepTimeoutNotifierRewardMultiplier
        );
        (
            uint64 movingFundsTxMaxTotalFee,
            uint64 movingFundsDustThreshold,
            uint32 movingFundsTimeoutResetDelay,
            uint32 movingFundsTimeout,
            uint96 movingFundsTimeoutSlashingAmount,
            uint256 movingFundsTimeoutNotifierRewardMultiplier,
            uint64 movedFundsSweepTxMaxTotalFee,
            uint32 movedFundsSweepTimeout,
            uint96 movedFundsSweepTimeoutSlashingAmount,

        ) = bridge.movingFundsParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateMovingFundsParameters(
            movingFundsTxMaxTotalFee,
            movingFundsDustThreshold,
            movingFundsTimeoutResetDelay,
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            newMovedFundsSweepTimeoutNotifierRewardMultiplier
        );
        newMovedFundsSweepTimeoutNotifierRewardMultiplier = 0;
        movedFundsSweepTimeoutNotifierRewardMultiplierChangeInitiated = 0;
    }

    /// @notice Begins the wallet creation period update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletCreationPeriod New wallet creation period.
    function beginWalletCreationPeriodUpdate(uint32 _newWalletCreationPeriod)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newWalletCreationPeriod = _newWalletCreationPeriod;
        walletCreationPeriodChangeInitiated = block.timestamp;
        emit WalletCreationPeriodUpdateStarted(
            _newWalletCreationPeriod,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the wallet creation period update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletCreationPeriodUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(walletCreationPeriodChangeInitiated)
    {
        emit WalletCreationPeriodUpdated(newWalletCreationPeriod);
        (
            ,
            uint64 walletCreationMinBtcBalance,
            uint64 walletCreationMaxBtcBalance,
            uint64 walletClosureMinBtcBalance,
            uint32 walletMaxAge,
            uint64 walletMaxBtcTransfer,
            uint32 walletClosingPeriod
        ) = bridge.walletParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateWalletParameters(
            newWalletCreationPeriod,
            walletCreationMinBtcBalance,
            walletCreationMaxBtcBalance,
            walletClosureMinBtcBalance,
            walletMaxAge,
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        newWalletCreationPeriod = 0;
        walletCreationPeriodChangeInitiated = 0;
    }

    /// @notice Begins the wallet creation min btc balance update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletCreationMinBtcBalance New wallet creation min btc balance.
    function beginWalletCreationMinBtcBalanceUpdate(
        uint64 _newWalletCreationMinBtcBalance
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newWalletCreationMinBtcBalance = _newWalletCreationMinBtcBalance;
        walletCreationMinBtcBalanceChangeInitiated = block.timestamp;
        emit WalletCreationMinBtcBalanceUpdateStarted(
            _newWalletCreationMinBtcBalance,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the wallet creation min btc balance update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletCreationMinBtcBalanceUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(walletCreationMinBtcBalanceChangeInitiated)
    {
        emit WalletCreationMinBtcBalanceUpdated(newWalletCreationMinBtcBalance);
        (
            uint32 walletCreationPeriod,
            ,
            uint64 walletCreationMaxBtcBalance,
            uint64 walletClosureMinBtcBalance,
            uint32 walletMaxAge,
            uint64 walletMaxBtcTransfer,
            uint32 walletClosingPeriod
        ) = bridge.walletParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateWalletParameters(
            walletCreationPeriod,
            newWalletCreationMinBtcBalance,
            walletCreationMaxBtcBalance,
            walletClosureMinBtcBalance,
            walletMaxAge,
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        newWalletCreationMinBtcBalance = 0;
        walletCreationMinBtcBalanceChangeInitiated = 0;
    }

    /// @notice Begins the wallet creation max btc balance update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletCreationMaxBtcBalance New wallet creation max btc balance.
    function beginWalletCreationMaxBtcBalanceUpdate(
        uint64 _newWalletCreationMaxBtcBalance
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newWalletCreationMaxBtcBalance = _newWalletCreationMaxBtcBalance;
        walletCreationMaxBtcBalanceChangeInitiated = block.timestamp;
        emit WalletCreationMaxBtcBalanceUpdateStarted(
            _newWalletCreationMaxBtcBalance,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the wallet creation max btc balance update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletCreationMaxBtcBalanceUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(walletCreationMaxBtcBalanceChangeInitiated)
    {
        emit WalletCreationMaxBtcBalanceUpdated(newWalletCreationMaxBtcBalance);
        (
            uint32 walletCreationPeriod,
            uint64 walletCreationMinBtcBalance,
            ,
            uint64 walletClosureMinBtcBalance,
            uint32 walletMaxAge,
            uint64 walletMaxBtcTransfer,
            uint32 walletClosingPeriod
        ) = bridge.walletParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateWalletParameters(
            walletCreationPeriod,
            walletCreationMinBtcBalance,
            newWalletCreationMaxBtcBalance,
            walletClosureMinBtcBalance,
            walletMaxAge,
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        newWalletCreationMaxBtcBalance = 0;
        walletCreationMaxBtcBalanceChangeInitiated = 0;
    }

    /// @notice Begins the wallet closure min btc balance update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletClosureMinBtcBalance New wallet closure min btc balance.
    function beginWalletClosureMinBtcBalanceUpdate(
        uint64 _newWalletClosureMinBtcBalance
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newWalletClosureMinBtcBalance = _newWalletClosureMinBtcBalance;
        walletClosureMinBtcBalanceChangeInitiated = block.timestamp;
        emit WalletClosureMinBtcBalanceUpdateStarted(
            _newWalletClosureMinBtcBalance,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the wallet closure min btc balance update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletClosureMinBtcBalanceUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(walletClosureMinBtcBalanceChangeInitiated)
    {
        emit WalletClosureMinBtcBalanceUpdated(newWalletClosureMinBtcBalance);
        (
            uint32 walletCreationPeriod,
            uint64 walletCreationMinBtcBalance,
            uint64 walletCreationMaxBtcBalance,
            ,
            uint32 walletMaxAge,
            uint64 walletMaxBtcTransfer,
            uint32 walletClosingPeriod
        ) = bridge.walletParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateWalletParameters(
            walletCreationPeriod,
            walletCreationMinBtcBalance,
            walletCreationMaxBtcBalance,
            newWalletClosureMinBtcBalance,
            walletMaxAge,
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        newWalletClosureMinBtcBalance = 0;
        walletClosureMinBtcBalanceChangeInitiated = 0;
    }

    /// @notice Begins the wallet max age update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletMaxAge New wallet max age.
    function beginWalletMaxAgeUpdate(uint32 _newWalletMaxAge)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newWalletMaxAge = _newWalletMaxAge;
        walletMaxAgeChangeInitiated = block.timestamp;
        emit WalletMaxAgeUpdateStarted(_newWalletMaxAge, block.timestamp);
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the wallet max age update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletMaxAgeUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(walletMaxAgeChangeInitiated)
    {
        emit WalletMaxAgeUpdated(newWalletMaxAge);
        (
            uint32 walletCreationPeriod,
            uint64 walletCreationMinBtcBalance,
            uint64 walletCreationMaxBtcBalance,
            uint64 walletClosureMinBtcBalance,
            ,
            uint64 walletMaxBtcTransfer,
            uint32 walletClosingPeriod
        ) = bridge.walletParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateWalletParameters(
            walletCreationPeriod,
            walletCreationMinBtcBalance,
            walletCreationMaxBtcBalance,
            walletClosureMinBtcBalance,
            newWalletMaxAge,
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        newWalletMaxAge = 0;
        walletMaxAgeChangeInitiated = 0;
    }

    /// @notice Begins the wallet closing period update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletMaxBtcTransfer New wallet closing period.
    function beginWalletMaxBtcTransferUpdate(uint64 _newWalletMaxBtcTransfer)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newWalletMaxBtcTransfer = _newWalletMaxBtcTransfer;
        walletMaxBtcTransferChangeInitiated = block.timestamp;
        emit WalletMaxBtcTransferUpdateStarted(
            _newWalletMaxBtcTransfer,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the wallet closing period update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletMaxBtcTransferUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(walletMaxBtcTransferChangeInitiated)
    {
        emit WalletMaxBtcTransferUpdated(newWalletMaxBtcTransfer);
        (
            uint32 walletCreationPeriod,
            uint64 walletCreationMinBtcBalance,
            uint64 walletCreationMaxBtcBalance,
            uint64 walletClosureMinBtcBalance,
            uint32 walletMaxAge,
            ,
            uint32 walletClosingPeriod
        ) = bridge.walletParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateWalletParameters(
            walletCreationPeriod,
            walletCreationMinBtcBalance,
            walletCreationMaxBtcBalance,
            walletClosureMinBtcBalance,
            walletMaxAge,
            newWalletMaxBtcTransfer,
            walletClosingPeriod
        );
        newWalletMaxBtcTransfer = 0;
        walletMaxBtcTransferChangeInitiated = 0;
    }

    /// @notice Begins the wallet closing period update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletClosingPeriod New wallet closing period.
    function beginWalletClosingPeriodUpdate(uint32 _newWalletClosingPeriod)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newWalletClosingPeriod = _newWalletClosingPeriod;
        walletClosingPeriodChangeInitiated = block.timestamp;
        emit WalletClosingPeriodUpdateStarted(
            _newWalletClosingPeriod,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the wallet closing period update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletClosingPeriodUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(walletClosingPeriodChangeInitiated)
    {
        emit WalletClosingPeriodUpdated(newWalletClosingPeriod);
        (
            uint32 walletCreationPeriod,
            uint64 walletCreationMinBtcBalance,
            uint64 walletCreationMaxBtcBalance,
            uint64 walletClosureMinBtcBalance,
            uint32 walletMaxAge,
            uint64 walletMaxBtcTransfer,

        ) = bridge.walletParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateWalletParameters(
            walletCreationPeriod,
            walletCreationMinBtcBalance,
            walletCreationMaxBtcBalance,
            walletClosureMinBtcBalance,
            walletMaxAge,
            walletMaxBtcTransfer,
            newWalletClosingPeriod
        );
        newWalletClosingPeriod = 0;
        walletClosingPeriodChangeInitiated = 0;
    }

    /// @notice Begins the fraud challenge deposit amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newFraudChallengeDepositAmount New fraud challenge deposit amount.
    function beginFraudChallengeDepositAmountUpdate(
        uint64 _newFraudChallengeDepositAmount
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newFraudChallengeDepositAmount = _newFraudChallengeDepositAmount;
        fraudChallengeDefeatTimeoutChangeInitiated = block.timestamp;
        emit FraudChallengeDepositAmountUpdateStarted(
            _newFraudChallengeDepositAmount,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the fraud challenge deposit amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeFraudChallengeDepositAmountUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(fraudChallengeDefeatTimeoutChangeInitiated)
    {
        emit FraudChallengeDepositAmountUpdated(newFraudChallengeDepositAmount);
        (
            ,
            uint256 fraudChallengeDefeatTimeout,
            uint96 fraudSlashingAmount,
            uint256 fraudNotifierRewardMultiplier
        ) = bridge.fraudParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateFraudParameters(
            newFraudChallengeDepositAmount,
            fraudChallengeDefeatTimeout,
            fraudSlashingAmount,
            fraudNotifierRewardMultiplier
        );
        newFraudChallengeDepositAmount = 0;
        fraudChallengeDefeatTimeoutChangeInitiated = 0;
    }

    /// @notice Begins the fraud challenge defeat timeout update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newFraudChallengeDefeatTimeout New fraud challenge defeat timeout.
    function beginFraudChallengeDefeatTimeoutUpdate(
        uint64 _newFraudChallengeDefeatTimeout
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newFraudChallengeDefeatTimeout = _newFraudChallengeDefeatTimeout;
        fraudChallengeDefeatTimeoutChangeInitiated = block.timestamp;
        emit FraudChallengeDefeatTimeoutUpdateStarted(
            _newFraudChallengeDefeatTimeout,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the fraud challenge defeat timeout update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeFraudChallengeDefeatTimeoutUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(fraudChallengeDefeatTimeoutChangeInitiated)
    {
        emit FraudChallengeDefeatTimeoutUpdated(newFraudChallengeDefeatTimeout);
        (
            uint256 fraudChallengeDepositAmount,
            ,
            uint96 fraudSlashingAmount,
            uint256 fraudNotifierRewardMultiplier
        ) = bridge.fraudParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateFraudParameters(
            fraudChallengeDepositAmount,
            newFraudChallengeDefeatTimeout,
            fraudSlashingAmount,
            fraudNotifierRewardMultiplier
        );
        newFraudChallengeDefeatTimeout = 0;
        fraudChallengeDefeatTimeoutChangeInitiated = 0;
    }

    /// @notice Begins the fraud slashing amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newFraudSlashingAmount New fraud slashing amount.
    function beginFraudSlashingAmountUpdate(uint64 _newFraudSlashingAmount)
        external
        onlyOwner
    {
        /* solhint-disable not-rely-on-time */
        newFraudSlashingAmount = _newFraudSlashingAmount;
        fraudSlashingAmountChangeInitiated = block.timestamp;
        emit FraudSlashingAmountUpdateStarted(
            _newFraudSlashingAmount,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the fraud slashing amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeFraudSlashingAmountUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(fraudSlashingAmountChangeInitiated)
    {
        emit FraudSlashingAmountUpdated(newFraudSlashingAmount);
        (
            uint256 fraudChallengeDepositAmount,
            uint256 fraudChallengeDefeatTimeout,
            ,
            uint256 fraudNotifierRewardMultiplier
        ) = bridge.fraudParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateFraudParameters(
            fraudChallengeDepositAmount,
            fraudChallengeDefeatTimeout,
            newFraudSlashingAmount,
            fraudNotifierRewardMultiplier
        );
        newFraudSlashingAmount = 0;
        fraudSlashingAmountChangeInitiated = 0;
    }

    uint64 public newFraudNotifierRewardMultiplier;
    uint256 public fraudNotifierRewardMultiplierChangeInitiated;

    event FraudNotifierRewardMultiplierUpdateStarted(
        uint64 newFraudNotifierRewardMultiplierThreshold,
        uint256 timestamp
    );
    event FraudNotifierRewardMultiplierUpdated(
        uint64 fraudNotifierRewardMultiplier
    );

    /// @notice Begins the fraud notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newFraudNotifierRewardMultiplier New fraud notifier reward multiplier.
    function beginFraudNotifierRewardMultiplierUpdate(
        uint64 _newFraudNotifierRewardMultiplier
    ) external onlyOwner {
        /* solhint-disable not-rely-on-time */
        newFraudNotifierRewardMultiplier = _newFraudNotifierRewardMultiplier;
        fraudNotifierRewardMultiplierChangeInitiated = block.timestamp;
        emit FraudNotifierRewardMultiplierUpdateStarted(
            _newFraudNotifierRewardMultiplier,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the fraud notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeFraudNotifierRewardMultiplierUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(fraudNotifierRewardMultiplierChangeInitiated)
    {
        emit FraudNotifierRewardMultiplierUpdated(
            newFraudNotifierRewardMultiplier
        );
        (
            uint256 fraudChallengeDepositAmount,
            uint256 fraudChallengeDefeatTimeout,
            uint96 fraudSlashingAmount,

        ) = bridge.fraudParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateFraudParameters(
            fraudChallengeDepositAmount,
            fraudChallengeDefeatTimeout,
            fraudSlashingAmount,
            newFraudNotifierRewardMultiplier
        );
        newFraudNotifierRewardMultiplier = 0;
        fraudNotifierRewardMultiplierChangeInitiated = 0;
    }

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

    function getRemainingMovingFundsParamsUpdateTime()
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
            uint256
        )
    {
        return (
            getRemainingChangeTime(movingFundsTxMaxTotalFeeChangeInitiated),
            getRemainingChangeTime(movingFundsDustThresholdChangeInitiated),
            getRemainingChangeTime(movingFundsTimeoutResetDelayChangeInitiated),
            getRemainingChangeTime(movingFundsTimeoutChangeInitiated),
            getRemainingChangeTime(
                movingFundsTimeoutSlashingAmountChangeInitiated
            ),
            getRemainingChangeTime(
                movingFundsTimeoutNotifierRewardMultiplierChangeInitiated
            ),
            getRemainingChangeTime(movedFundsSweepTxMaxTotalFeeChangeInitiated),
            getRemainingChangeTime(movedFundsSweepTimeoutChangeInitiated),
            getRemainingChangeTime(
                movedFundsSweepTimeoutSlashingAmountChangeInitiated
            ),
            getRemainingChangeTime(
                movedFundsSweepTimeoutNotifierRewardMultiplierChangeInitiated
            )
        );
    }

    function getRemainingWalletParamsUpdateTime()
        external
        view
        returns (
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
            getRemainingChangeTime(walletCreationPeriodChangeInitiated),
            getRemainingChangeTime(walletCreationMinBtcBalanceChangeInitiated),
            getRemainingChangeTime(walletCreationMaxBtcBalanceChangeInitiated),
            getRemainingChangeTime(walletClosureMinBtcBalanceChangeInitiated),
            getRemainingChangeTime(walletMaxAgeChangeInitiated),
            getRemainingChangeTime(walletMaxBtcTransferChangeInitiated),
            getRemainingChangeTime(walletClosingPeriodChangeInitiated)
        );
    }

    function getRemainingFraudParamsUpdateTime()
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            getRemainingChangeTime(fraudChallengeDepositAmountChangeInitiated),
            getRemainingChangeTime(fraudChallengeDefeatTimeoutChangeInitiated),
            getRemainingChangeTime(fraudSlashingAmountChangeInitiated),
            getRemainingChangeTime(fraudNotifierRewardMultiplierChangeInitiated)
        );
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
