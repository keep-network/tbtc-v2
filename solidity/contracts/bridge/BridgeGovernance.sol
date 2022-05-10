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

    // TODO: - implement a governable delay for updating parameters,
    //       - allow transferring the governance of Bridge to some other contract,
    //       - allow to update a single parameter without having to pass values of other parameters (less error-prone update).

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

    // TODO: update
    //     uint64 depositTreasuryFeeDivisor,
    //     uint64 depositTxMaxFee
    //     uint64 redemptionDustThreshold,
    //     uint64 redemptionTreasuryFeeDivisor,
    //     uint64 redemptionTxMaxFee,
    //     uint256 redemptionTimeout,
    //     uint96 redemptionTimeoutSlashingAmount,
    //     uint256 redemptionTimeoutNotifierRewardMultiplier
    //     uint64 movingFundsTxMaxTotalFee,
    //     uint64 movingFundsDustThreshold,
    //     uint32 movingFundsTimeout,
    //     uint96 movingFundsTimeoutSlashingAmount,
    //     uint256 movingFundsTimeoutNotifierRewardMultiplier,
    //     uint64 movedFundsSweepTxMaxTotalFee,
    //     uint32 movedFundsSweepTimeout,
    //     uint96 movedFundsSweepTimeoutSlashingAmount,
    //     uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
    //     uint32 walletCreationPeriod,
    //     uint64 walletCreationMinBtcBalance,
    //     uint64 walletCreationMaxBtcBalance,
    //     uint64 walletClosureMinBtcBalance,
    //     uint32 walletMaxAge,
    //     uint64 walletMaxBtcTransfer,
    //     uint32 walletClosingPeriod
    //     uint256 fraudChallengeDepositAmount,
    //     uint256 fraudChallengeDefeatTimeout,
    //     uint96 fraudSlashingAmount,
    //     uint256 fraudNotifierRewardMultiplier
}
