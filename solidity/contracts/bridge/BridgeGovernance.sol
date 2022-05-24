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
import "./BridgeGovernanceParameters.sol";

import "./Bridge.sol";

/// @title Bridge Governance
/// @notice Owns the `Bridge` contract and is responsible for updating
///         its governable parameters in respect to governance delay individual
///         for each parameter. The other resposibility is marking a vault
///         address as trusted or no longer trusted.
contract BridgeGovernance is Ownable {
    using BridgeGovernanceParameters for BridgeGovernanceParameters.DepositData;
    using BridgeGovernanceParameters for BridgeGovernanceParameters.RedemptionData;
    using BridgeGovernanceParameters for BridgeGovernanceParameters.MovingFundsData;
    using BridgeGovernanceParameters for BridgeGovernanceParameters.WalletData;
    using BridgeGovernanceParameters for BridgeGovernanceParameters.FraudData;

    BridgeGovernanceParameters.DepositData internal depositData;
    BridgeGovernanceParameters.RedemptionData internal redemptionData;
    BridgeGovernanceParameters.MovingFundsData internal movingFundsData;
    BridgeGovernanceParameters.WalletData internal walletData;
    BridgeGovernanceParameters.FraudData internal fraudData;

    Bridge internal bridge;

    // governanceDelays[0] -> governanceDelay
    // governanceDelays[1] -> newGovernanceDelay
    // governanceDelays[2] -> governanceDelayChangeInitiated
    uint256[3] public governanceDelays;

    uint256 public bridgeGovernanceTransferChangeInitiated;
    address internal newBridgeGovernance;

    event GovernanceDelayUpdateStarted(
        uint256 newGovernanceDelay,
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
        uint96 newMovingFundsTimeoutSlashingAmountThreshold,
        uint256 timestamp
    );
    event MovingFundsTimeoutSlashingAmountUpdated(
        uint96 movingFundsTimeoutSlashingAmount
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
        uint32 newMovedFundsSweepTimeoutThreshold,
        uint256 timestamp
    );
    event MovedFundsSweepTimeoutUpdated(uint32 movedFundsSweepTimeout);

    event MovedFundsSweepTimeoutSlashingAmountUpdateStarted(
        uint96 newMovedFundsSweepTimeoutSlashingAmountThreshold,
        uint256 timestamp
    );
    event MovedFundsSweepTimeoutSlashingAmountUpdated(
        uint96 movedFundsSweepTimeoutSlashingAmount
    );

    event MovedFundsSweepTimeoutNotifierRewardMultiplierUpdateStarted(
        uint256 newMovedFundsSweepTimeoutNotifierRewardMultiplierThreshold,
        uint256 timestamp
    );
    event MovedFundsSweepTimeoutNotifierRewardMultiplierUpdated(
        uint256 movedFundsSweepTimeoutNotifierRewardMultiplier
    );

    event WalletCreationPeriodUpdateStarted(
        uint32 newWalletCreationPeriodThreshold,
        uint256 timestamp
    );
    event WalletCreationPeriodUpdated(uint32 walletCreationPeriod);

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

    event FraudNotifierRewardMultiplierUpdateStarted(
        uint256 newFraudNotifierRewardMultiplier,
        uint256 timestamp
    );
    event FraudNotifierRewardMultiplierUpdated(
        uint256 fraudNotifierRewardMultiplier
    );

    constructor(Bridge _bridge, uint256 _governanceDelay) {
        bridge = _bridge;
        governanceDelays[0] = _governanceDelay;
    }

    /// @notice Allows the Governance to mark the given vault address as trusted
    ///         or no longer trusted. Vaults are not trusted by default.
    ///         Trusted vault must meet the following criteria:
    ///         - `IVault.receiveBalanceIncrease` must have a known, low gas
    ///           cost,
    ///         - `IVault.receiveBalanceIncrease` must never revert.
    /// @param vault The address of the vault.
    /// @param isTrusted flag indicating whether the vault is trusted or not.
    function setVaultStatus(address vault, bool isTrusted) external onlyOwner {
        bridge.setVaultStatus(vault, isTrusted);
    }

    /// @notice Begins the governance delay update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newGovernanceDelay New governance delay
    function beginGovernanceDelayUpdate(uint256 _newGovernanceDelay)
        external
        onlyOwner
    {
        governanceDelays[1] = _newGovernanceDelay;
        /* solhint-disable not-rely-on-time */
        governanceDelays[2] = block.timestamp;
        emit GovernanceDelayUpdateStarted(_newGovernanceDelay, block.timestamp);
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the governance delay update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeGovernanceDelayUpdate() external onlyOwner {
        require(governanceDelays[2] > 0, "Change not initiated");
        /* solhint-disable not-rely-on-time */
        require(
            block.timestamp - governanceDelays[2] >= governanceDelays[0],
            "Governance delay has not elapsed"
        );
        /* solhint-enable not-rely-on-time */
        emit GovernanceDelayUpdated(governanceDelays[1]);
        governanceDelays[0] = governanceDelays[1];
        governanceDelays[1] = 0;
        governanceDelays[2] = 0;
    }

    /// @notice Begins the Bridge governance transfer process.
    /// @dev Can be called only by the contract owner. It is the governance
    ///      resposibility to validate the corectness of the new Bridge
    ///      Governance contract.
    function beginBridgeGovernanceTransfer(address _newBridgeGovernance)
        external
        onlyOwner
    {
        newBridgeGovernance = _newBridgeGovernance;
        /* solhint-disable not-rely-on-time */
        bridgeGovernanceTransferChangeInitiated = block.timestamp;
        emit BridgeGovernanceTransferStarted(
            _newBridgeGovernance,
            bridgeGovernanceTransferChangeInitiated
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the bridge governance transfer process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeBridgeGovernanceTransfer() external onlyOwner {
        require(
            bridgeGovernanceTransferChangeInitiated > 0,
            "Change not initiated"
        );
        /* solhint-disable not-rely-on-time */
        require(
            block.timestamp - bridgeGovernanceTransferChangeInitiated >=
                governanceDelays[0],
            "Governance delay has not elapsed"
        );
        /* solhint-enable not-rely-on-time */
        bridge.transferGovernance(newBridgeGovernance);
        emit BridgeGovernanceTransferred(newBridgeGovernance);
        bridgeGovernanceTransferChangeInitiated = 0;
    }

    // --- Deposit

    /// @notice Begins the deposit dust threshold amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositDustThreshold New deposit dust threshold amount.
    function beginDepositDustThresholdUpdate(uint64 _newDepositDustThreshold)
        external
        onlyOwner
    {
        depositData.beginDepositDustThresholdUpdate(_newDepositDustThreshold);
    }

    /// @notice Finalizes the deposit dust threshold amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositDustThresholdUpdate() external onlyOwner {
        (, uint64 depositTreasuryFeeDivisor, uint64 depositTxMaxFee) = bridge
            .depositParameters();
        bridge.updateDepositParameters(
            depositData.getNewDepositDustThreshold(),
            depositTreasuryFeeDivisor,
            depositTxMaxFee
        );
        depositData.finalizeDepositDustThresholdUpdate(governanceDelays[0]);
    }

    /// @notice Begins the deposit treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositTreasuryFeeDivisor New deposit treasury fee divisor.
    function beginDepositTreasuryFeeDivisorUpdate(
        uint64 _newDepositTreasuryFeeDivisor
    ) external onlyOwner {
        depositData.beginDepositTreasuryFeeDivisorUpdate(
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
            depositData.getNewDepositTreasuryFeeDivisor(),
            depositTxMaxFee
        );
        depositData.finalizeDepositTreasuryFeeDivisorUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the deposit tx max fee amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositTxMaxFee New deposit tx max fee.
    function beginDepositTxMaxFeeUpdate(uint64 _newDepositTxMaxFee)
        external
        onlyOwner
    {
        depositData.beginDepositTxMaxFeeUpdate(_newDepositTxMaxFee);
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
            depositData.getNewDepositTxMaxFee()
        );
        depositData.finalizeDepositTxMaxFeeUpdate(governanceDelays[0]);
    }

    // --- Redemption

    /// @notice Begins the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionDustThreshold New redemption treasury fee divisor.
    function beginRedemptionDustThresholdUpdate(
        uint64 _newRedemptionDustThreshold
    ) external onlyOwner {
        redemptionData.beginRedemptionDustThresholdUpdate(
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
            redemptionData.getNewRedemptionDustThreshold(),
            redemptionTreasuryFeeDivisor,
            redemptionTxMaxFee,
            redemptionTimeout,
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );

        redemptionData.finalizeRedemptionDustThresholdUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTreasuryFeeDivisor New redemption treasury fee divisor.
    function beginRedemptionTreasuryFeeDivisorUpdate(
        uint64 _newRedemptionTreasuryFeeDivisor
    ) external onlyOwner {
        redemptionData.beginRedemptionTreasuryFeeDivisorUpdate(
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
            redemptionData.getNewRedemptionTreasuryFeeDivisor(),
            redemptionTxMaxFee,
            redemptionTimeout,
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );

        redemptionData.finalizeRedemptionTreasuryFeeDivisorUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the redemption tx max fee amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTxMaxFee New redemption tx max fee.
    function beginRedemptionTxMaxFeeUpdate(uint64 _newRedemptionTxMaxFee)
        external
        onlyOwner
    {
        redemptionData.beginRedemptionTxMaxFeeUpdate(_newRedemptionTxMaxFee);
    }

    /// @notice Finalizes the redemption tx max fee amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTxMaxFeeUpdate() external onlyOwner {
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
            redemptionData.getNewRedemptionTxMaxFee(),
            redemptionTimeout,
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );

        redemptionData.finalizeRedemptionTxMaxFeeUpdate(governanceDelays[0]);
    }

    /// @notice Begins the redemption timeout amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTimeout New redemption timeout.
    function beginRedemptionTimeoutUpdate(uint64 _newRedemptionTimeout)
        external
        onlyOwner
    {
        redemptionData.beginRedemptionTimeoutUpdate(_newRedemptionTimeout);
    }

    /// @notice Finalizes the redemption timeout amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTimeoutUpdate() external onlyOwner {
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
            redemptionData.getNewRedemptionTimeout(),
            redemptionTimeoutSlashingAmount,
            redemptionTimeoutNotifierRewardMultiplier
        );

        redemptionData.finalizeRedemptionTimeoutUpdate(governanceDelays[0]);
    }

    /// @notice Begins the redemption timeout slashing amount amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTimeoutSlashingAmount New redemption timeout slashing amount.
    function beginRedemptionTimeoutSlashingAmountUpdate(
        uint96 _newRedemptionTimeoutSlashingAmount
    ) external onlyOwner {
        redemptionData.beginRedemptionTimeoutSlashingAmountUpdate(
            _newRedemptionTimeoutSlashingAmount
        );
    }

    /// @notice Finalizes the redemption timeout slashing amount amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTimeoutSlashingAmountUpdate()
        external
        onlyOwner
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
            redemptionData.getNewRedemptionTimeoutSlashingAmount(),
            redemptionTimeoutNotifierRewardMultiplier
        );

        redemptionData.finalizeRedemptionTimeoutSlashingAmountUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the redemption timeout notifier reward multiplier amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTimeoutNotifierRewardMultiplier New redemption timeout notifier reward multiplier.
    function beginRedemptionTimeoutNotifierRewardMultiplierUpdate(
        uint64 _newRedemptionTimeoutNotifierRewardMultiplier
    ) external onlyOwner {
        redemptionData.beginRedemptionTimeoutNotifierRewardMultiplierUpdate(
            _newRedemptionTimeoutNotifierRewardMultiplier
        );
    }

    /// @notice Finalizes the redemption timeout notifier reward multiplier amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTimeoutNotifierRewardMultiplierUpdate()
        external
        onlyOwner
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
            redemptionData.getNewRedemptionTimeoutNotifierRewardMultiplier()
        );

        redemptionData.finalizeRedemptionTimeoutNotifierRewardMultiplierUpdate(
            governanceDelays[0]
        );
    }

    // --- Moving funds

    /// @notice Begins the moving funds tx max total fee update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTxMaxTotalFee New moving funds tx max total fee.
    function beginMovingFundsTxMaxTotalFeeUpdate(
        uint64 _newMovingFundsTxMaxTotalFee
    ) external onlyOwner {
        movingFundsData.beginMovingFundsTxMaxTotalFeeUpdate(
            _newMovingFundsTxMaxTotalFee
        );
    }

    /// @notice Finalizes the moving funds tx max total fee update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTxMaxTotalFeeUpdate() external onlyOwner {
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
            movingFundsData.getNewMovingFundsTxMaxTotalFee(),
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
        movingFundsData.finalizeMovingFundsTxMaxTotalFeeUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the moving funds dust threshold update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsDustThreshold New moving funds dust threshold.
    function beginMovingFundsDustThresholdUpdate(
        uint64 _newMovingFundsDustThreshold
    ) external onlyOwner {
        movingFundsData.beginMovingFundsDustThresholdUpdate(
            _newMovingFundsDustThreshold
        );
    }

    /// @notice Finalizes the moving funds dust threshold update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsDustThresholdUpdate() external onlyOwner {
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
            movingFundsData.getNewMovingFundsDustThreshold(),
            movingFundsTimeoutResetDelay,
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        movingFundsData.finalizeMovingFundsDustThresholdUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the moving funds timeout reset delay update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTimeoutResetDelay New moving funds timeout reset delay.
    function beginMovingFundsTimeoutResetDelayUpdate(
        uint32 _newMovingFundsTimeoutResetDelay
    ) external onlyOwner {
        movingFundsData.beginMovingFundsTimeoutResetDelayUpdate(
            _newMovingFundsTimeoutResetDelay
        );
    }

    /// @notice Finalizes the moving funds timeout reset delay update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTimeoutResetDelayUpdate() external onlyOwner {
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
            movingFundsData.getNewMovingFundsTimeoutResetDelay(),
            movingFundsTimeout,
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        movingFundsData.finalizeMovingFundsTimeoutResetDelayUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the moving funds timeout update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTimeout New moving funds timeout.
    function beginMovingFundsTimeoutUpdate(uint32 _newMovingFundsTimeout)
        external
        onlyOwner
    {
        movingFundsData.beginMovingFundsTimeoutUpdate(_newMovingFundsTimeout);
    }

    /// @notice Finalizes the moving funds timeout update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTimeoutUpdate() external onlyOwner {
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
            movingFundsData.getNewMovingFundsTimeout(),
            movingFundsTimeoutSlashingAmount,
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        movingFundsData.finalizeMovingFundsTimeoutUpdate(governanceDelays[0]);
    }

    /// @notice Begins the moving funds timeout slashing amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTimeoutSlashingAmount New moving funds timeout slashing amount.
    function beginMovingFundsTimeoutSlashingAmountUpdate(
        uint96 _newMovingFundsTimeoutSlashingAmount
    ) external onlyOwner {
        movingFundsData.beginMovingFundsTimeoutSlashingAmountUpdate(
            _newMovingFundsTimeoutSlashingAmount
        );
    }

    /// @notice Finalizes the moving funds timeout slashing amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTimeoutSlashingAmountUpdate()
        external
        onlyOwner
    {
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
            movingFundsData.getNewMovingFundsTimeoutSlashingAmount(),
            movingFundsTimeoutNotifierRewardMultiplier,
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        movingFundsData.finalizeMovingFundsTimeoutSlashingAmountUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the moving funds timeout notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovingFundsTimeoutNotifierRewardMultiplier New moving funds timeout notifier reward multiplier.
    function beginMovingFundsTimeoutNotifierRewardMultiplierUpdate(
        uint64 _newMovingFundsTimeoutNotifierRewardMultiplier
    ) external onlyOwner {
        movingFundsData.beginMovingFundsTimeoutNotifierRewardMultiplierUpdate(
            _newMovingFundsTimeoutNotifierRewardMultiplier
        );
    }

    /// @notice Finalizes the moving funds timeout notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovingFundsTimeoutNotifierRewardMultiplierUpdate()
        external
        onlyOwner
    {
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
            movingFundsData.getNewMovingFundsTimeoutNotifierRewardMultiplier(),
            movedFundsSweepTxMaxTotalFee,
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        movingFundsData
            .finalizeMovingFundsTimeoutNotifierRewardMultiplierUpdate(
                governanceDelays[0]
            );
    }

    /// @notice Begins the moved funds sweep tx max total fee update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovedFundsSweepTxMaxTotalFee New moved funds sweep tx max total fee.
    function beginMovedFundsSweepTxMaxTotalFeeUpdate(
        uint64 _newMovedFundsSweepTxMaxTotalFee
    ) external onlyOwner {
        movingFundsData.beginMovedFundsSweepTxMaxTotalFeeUpdate(
            _newMovedFundsSweepTxMaxTotalFee
        );
    }

    /// @notice Finalizes the moved funds sweep tx max total fee update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovedFundsSweepTxMaxTotalFeeUpdate() external onlyOwner {
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
            movingFundsData.getNewMovedFundsSweepTxMaxTotalFee(),
            movedFundsSweepTimeout,
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        movingFundsData.finalizeMovedFundsSweepTxMaxTotalFeeUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the moved funds sweep timeout update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovedFundsSweepTimeout New moved funds sweep timeout.
    function beginMovedFundsSweepTimeoutUpdate(
        uint32 _newMovedFundsSweepTimeout
    ) external onlyOwner {
        movingFundsData.beginMovedFundsSweepTimeoutUpdate(
            _newMovedFundsSweepTimeout
        );
    }

    /// @notice Finalizes the moved funds sweep timeout update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovedFundsSweepTimeoutUpdate() external onlyOwner {
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
            movingFundsData.getNewMovedFundsSweepTimeout(),
            movedFundsSweepTimeoutSlashingAmount,
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        movingFundsData.finalizeMovedFundsSweepTimeoutUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the moved funds sweep timeout slashing amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovedFundsSweepTimeoutSlashingAmount New moved funds sweep timeout slashing amount.
    function beginMovedFundsSweepTimeoutSlashingAmountUpdate(
        uint96 _newMovedFundsSweepTimeoutSlashingAmount
    ) external onlyOwner {
        movingFundsData.beginMovedFundsSweepTimeoutSlashingAmountUpdate(
            _newMovedFundsSweepTimeoutSlashingAmount
        );
    }

    /// @notice Finalizes the moved funds sweep timeout slashing amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovedFundsSweepTimeoutSlashingAmountUpdate()
        external
        onlyOwner
    {
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
            movingFundsData.getNewMovedFundsSweepTimeoutSlashingAmount(),
            movedFundsSweepTimeoutNotifierRewardMultiplier
        );
        movingFundsData.finalizeMovedFundsSweepTimeoutSlashingAmountUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the moved funds sweep timeout notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newMovedFundsSweepTimeoutNotifierRewardMultiplier New moved funds sweep timeout notifier reward multiplier.
    function beginMovedFundsSweepTimeoutNotifierRewardMultiplierUpdate(
        uint64 _newMovedFundsSweepTimeoutNotifierRewardMultiplier
    ) external onlyOwner {
        movingFundsData
            .beginMovedFundsSweepTimeoutNotifierRewardMultiplierUpdate(
                _newMovedFundsSweepTimeoutNotifierRewardMultiplier
            );
    }

    /// @notice Finalizes the moved funds sweep timeout notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeMovedFundsSweepTimeoutNotifierRewardMultiplierUpdate()
        external
        onlyOwner
    {
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
            movingFundsData
                .getNewMovedFundsSweepTimeoutNotifierRewardMultiplier()
        );
        movingFundsData
            .finalizeMovedFundsSweepTimeoutNotifierRewardMultiplierUpdate(
                governanceDelays[0]
            );
    }

    // --- Wallet creation

    /// @notice Begins the wallet creation period update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletCreationPeriod New wallet creation period.
    function beginWalletCreationPeriodUpdate(uint32 _newWalletCreationPeriod)
        external
        onlyOwner
    {
        walletData.beginWalletCreationPeriodUpdate(_newWalletCreationPeriod);
    }

    /// @notice Finalizes the wallet creation period update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletCreationPeriodUpdate() external onlyOwner {
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
            walletData.getNewWalletCreationPeriod(),
            walletCreationMinBtcBalance,
            walletCreationMaxBtcBalance,
            walletClosureMinBtcBalance,
            walletMaxAge,
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        walletData.finalizeWalletCreationPeriodUpdate(governanceDelays[0]);
    }

    /// @notice Begins the wallet creation min btc balance update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletCreationMinBtcBalance New wallet creation min btc balance.
    function beginWalletCreationMinBtcBalanceUpdate(
        uint64 _newWalletCreationMinBtcBalance
    ) external onlyOwner {
        walletData.beginWalletCreationMinBtcBalanceUpdate(
            _newWalletCreationMinBtcBalance
        );
    }

    /// @notice Finalizes the wallet creation min btc balance update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletCreationMinBtcBalanceUpdate() external onlyOwner {
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
            walletData.getNewWalletCreationMinBtcBalance(),
            walletCreationMaxBtcBalance,
            walletClosureMinBtcBalance,
            walletMaxAge,
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        walletData.finalizeWalletCreationMinBtcBalanceUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the wallet creation max btc balance update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletCreationMaxBtcBalance New wallet creation max btc balance.
    function beginWalletCreationMaxBtcBalanceUpdate(
        uint64 _newWalletCreationMaxBtcBalance
    ) external onlyOwner {
        walletData.beginWalletCreationMaxBtcBalanceUpdate(
            _newWalletCreationMaxBtcBalance
        );
    }

    /// @notice Finalizes the wallet creation max btc balance update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletCreationMaxBtcBalanceUpdate() external onlyOwner {
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
            walletData.getNewWalletCreationMaxBtcBalance(),
            walletClosureMinBtcBalance,
            walletMaxAge,
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        walletData.finalizeWalletCreationMaxBtcBalanceUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the wallet closure min btc balance update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletClosureMinBtcBalance New wallet closure min btc balance.
    function beginWalletClosureMinBtcBalanceUpdate(
        uint64 _newWalletClosureMinBtcBalance
    ) external onlyOwner {
        walletData.beginWalletClosureMinBtcBalanceUpdate(
            _newWalletClosureMinBtcBalance
        );
    }

    /// @notice Finalizes the wallet closure min btc balance update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletClosureMinBtcBalanceUpdate() external onlyOwner {
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
            walletData.getNewWalletClosureMinBtcBalance(),
            walletMaxAge,
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        walletData.finalizeWalletClosureMinBtcBalanceUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the wallet max age update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletMaxAge New wallet max age.
    function beginWalletMaxAgeUpdate(uint32 _newWalletMaxAge)
        external
        onlyOwner
    {
        walletData.beginWalletMaxAgeUpdate(_newWalletMaxAge);
    }

    /// @notice Finalizes the wallet max age update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletMaxAgeUpdate() external onlyOwner {
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
            walletData.getNewWalletMaxAge(),
            walletMaxBtcTransfer,
            walletClosingPeriod
        );
        walletData.finalizeWalletMaxAgeUpdate(governanceDelays[0]);
    }

    /// @notice Begins the wallet closing period update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletMaxBtcTransfer New wallet closing period.
    function beginWalletMaxBtcTransferUpdate(uint64 _newWalletMaxBtcTransfer)
        external
        onlyOwner
    {
        walletData.beginWalletMaxBtcTransferUpdate(_newWalletMaxBtcTransfer);
    }

    /// @notice Finalizes the wallet closing period update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletMaxBtcTransferUpdate() external onlyOwner {
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
            walletData.getNewWalletMaxBtcTransfer(),
            walletClosingPeriod
        );
        walletData.finalizeWalletMaxBtcTransferUpdate(governanceDelays[0]);
    }

    /// @notice Begins the wallet closing period update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newWalletClosingPeriod New wallet closing period.
    function beginWalletClosingPeriodUpdate(uint32 _newWalletClosingPeriod)
        external
        onlyOwner
    {
        walletData.beginWalletClosingPeriodUpdate(_newWalletClosingPeriod);
    }

    /// @notice Finalizes the wallet closing period update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeWalletClosingPeriodUpdate() external onlyOwner {
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
            walletData.getNewWalletClosingPeriod()
        );
        walletData.finalizeWalletClosingPeriodUpdate(governanceDelays[0]);
    }

    // --- Fraud

    /// @notice Begins the fraud challenge deposit amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newFraudChallengeDepositAmount New fraud challenge deposit amount.
    function beginFraudChallengeDepositAmountUpdate(
        uint256 _newFraudChallengeDepositAmount
    ) external onlyOwner {
        fraudData.beginFraudChallengeDepositAmountUpdate(
            _newFraudChallengeDepositAmount
        );
    }

    /// @notice Finalizes the fraud challenge deposit amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeFraudChallengeDepositAmountUpdate() external onlyOwner {
        (
            ,
            uint256 fraudChallengeDefeatTimeout,
            uint96 fraudSlashingAmount,
            uint256 fraudNotifierRewardMultiplier
        ) = bridge.fraudParameters();
        // slither-disable-next-line reentrancy-no-eth
        bridge.updateFraudParameters(
            fraudData.getNewFraudChallengeDepositAmount(),
            fraudChallengeDefeatTimeout,
            fraudSlashingAmount,
            fraudNotifierRewardMultiplier
        );
        fraudData.finalizeFraudChallengeDepositAmountUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the fraud challenge defeat timeout update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newFraudChallengeDefeatTimeout New fraud challenge defeat timeout.
    function beginFraudChallengeDefeatTimeoutUpdate(
        uint256 _newFraudChallengeDefeatTimeout
    ) external onlyOwner {
        fraudData.beginFraudChallengeDefeatTimeoutUpdate(
            _newFraudChallengeDefeatTimeout
        );
    }

    /// @notice Finalizes the fraud challenge defeat timeout update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeFraudChallengeDefeatTimeoutUpdate() external onlyOwner {
        (
            uint256 fraudChallengeDepositAmount,
            ,
            uint96 fraudSlashingAmount,
            uint256 fraudNotifierRewardMultiplier
        ) = bridge.fraudParameters();
        bridge.updateFraudParameters(
            fraudChallengeDepositAmount,
            fraudData.getNewFraudChallengeDefeatTimeout(),
            fraudSlashingAmount,
            fraudNotifierRewardMultiplier
        );
        fraudData.finalizeFraudChallengeDefeatTimeoutUpdate(
            governanceDelays[0]
        );
    }

    /// @notice Begins the fraud slashing amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newFraudSlashingAmount New fraud slashing amount.
    function beginFraudSlashingAmountUpdate(uint96 _newFraudSlashingAmount)
        external
        onlyOwner
    {
        fraudData.beginFraudSlashingAmountUpdate(_newFraudSlashingAmount);
    }

    /// @notice Finalizes the fraud slashing amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeFraudSlashingAmountUpdate() external onlyOwner {
        (
            uint256 fraudChallengeDepositAmount,
            uint256 fraudChallengeDefeatTimeout,
            ,
            uint256 fraudNotifierRewardMultiplier
        ) = bridge.fraudParameters();
        bridge.updateFraudParameters(
            fraudChallengeDepositAmount,
            fraudChallengeDefeatTimeout,
            fraudData.getNewFraudSlashingAmount(),
            fraudNotifierRewardMultiplier
        );
        fraudData.finalizeFraudSlashingAmountUpdate(governanceDelays[0]);
    }

    /// @notice Begins the fraud notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newFraudNotifierRewardMultiplier New fraud notifier reward multiplier.
    function beginFraudNotifierRewardMultiplierUpdate(
        uint256 _newFraudNotifierRewardMultiplier
    ) external onlyOwner {
        fraudData.beginFraudNotifierRewardMultiplierUpdate(
            _newFraudNotifierRewardMultiplier
        );
    }

    /// @notice Finalizes the fraud notifier reward multiplier update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeFraudNotifierRewardMultiplierUpdate() external onlyOwner {
        (
            uint256 fraudChallengeDepositAmount,
            uint256 fraudChallengeDefeatTimeout,
            uint96 fraudSlashingAmount,

        ) = bridge.fraudParameters();
        bridge.updateFraudParameters(
            fraudChallengeDepositAmount,
            fraudChallengeDefeatTimeout,
            fraudSlashingAmount,
            fraudData.getNewFraudNotifierRewardMultiplier()
        );
        fraudData.finalizeFraudNotifierRewardMultiplierUpdate(
            governanceDelays[0]
        );
    }
}
