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

// TODO: add desc
library BridgeGovernanceParams {
    struct Data {
        uint256 governanceDelay;
        uint256 newGovernanceDelay;
        uint256 governanceDelayChangeInitiated;
        address newBridgeGovernance;
        uint256 bridgeGovernanceTransferInitiated;
        uint64 newDepositDustThreshold;
        uint256 depositDustThresholdChangeInitiated;
        uint64 newDepositTreasuryFeeDivisor;
        uint256 depositTreasuryFeeDivisorChangeInitiated;
        uint64 newDepositTxMaxFee;
        uint256 depositTxMaxFeeChangeInitiated;
        uint64 newRedemptionDustThreshold;
        uint256 redemptionDustThresholdChangeInitiated;
        uint64 newRedemptionTreasuryFeeDivisor;
        uint256 redemptionTreasuryFeeDivisorChangeInitiated;
    }

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

    /// @notice Reverts if called before the governance delay elapses.
    /// @param changeInitiatedTimestamp Timestamp indicating the beginning
    ///        of the change.
    modifier onlyAfterGovernanceDelay(
        Data storage self,
        uint256 changeInitiatedTimestamp
    ) {
        /* solhint-disable not-rely-on-time */
        require(changeInitiatedTimestamp > 0, "Change not initiated");
        require(
            block.timestamp - changeInitiatedTimestamp >= self.governanceDelay,
            "Governance delay has not elapsed"
        );
        _;
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Inits governance delay param.
    /// @param _governanceDelay Governance delay
    function init(Data storage self, uint256 _governanceDelay) internal {
        self.governanceDelay = _governanceDelay;
    }

    /// @notice Begins the governance delay update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newGovernanceDelay New governance delay
    function beginGovernanceDelayUpdate(
        Data storage self,
        uint256 _newGovernanceDelay
    ) external {
        self.newGovernanceDelay = _newGovernanceDelay;
        /* solhint-disable not-rely-on-time */
        self.governanceDelayChangeInitiated = block.timestamp;
        emit GovernanceDelayUpdateStarted(_newGovernanceDelay, block.timestamp);
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the governance delay update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeGovernanceDelayUpdate(Data storage self)
        external
        onlyAfterGovernanceDelay(self, self.governanceDelayChangeInitiated)
    {
        emit GovernanceDelayUpdated(self.newGovernanceDelay);
        self.governanceDelay = self.newGovernanceDelay;
        self.governanceDelayChangeInitiated = 0;
        self.newGovernanceDelay = 0;
    }

    function getGovernanceDelay(Data storage self)
        external
        view
        returns (uint256)
    {
        return self.governanceDelay;
    }

    function getRemainingGovernanceDelayUpdateTime(Data storage self)
        external
        view
        returns (uint256)
    {
        return
            getRemainingChangeTime(self, self.governanceDelayChangeInitiated);
    }

    /// @notice Begins the Bridge governance transfer process.
    /// @dev Can be called only by the contract owner.
    function beginBridgeGovernanceTransfer(
        Data storage self,
        address _newBridgeGovernance
    ) external {
        require(
            address(_newBridgeGovernance) != address(0),
            "New bridge owner address cannot be zero"
        );
        self.newBridgeGovernance = _newBridgeGovernance;
        /* solhint-disable not-rely-on-time */
        self.bridgeGovernanceTransferInitiated = block.timestamp;
        emit BridgeGovernanceTransferStarted(
            _newBridgeGovernance,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the bridge governance transfer process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeBridgeGovernanceTransfer(Data storage self)
        external
        onlyAfterGovernanceDelay(self, self.bridgeGovernanceTransferInitiated)
    {
        emit BridgeGovernanceTransferred(self.newBridgeGovernance);
        self.bridgeGovernanceTransferInitiated = 0;
        self.newBridgeGovernance = address(0);
    }

    function getNewBridgeGovernance(Data storage self)
        external
        view
        returns (address)
    {
        return self.newBridgeGovernance;
    }

    function getRemainingBridgeGovernanceTransferDelayUpdateTime(
        Data storage self
    ) external view returns (uint256) {
        return
            getRemainingChangeTime(
                self,
                self.bridgeGovernanceTransferInitiated
            );
    }

    /// @notice Begins the deposit dust threshold amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositDustThreshold New deposit dust threshold amount.
    function beginDepositDustThresholdUpdate(
        Data storage self,
        uint64 _newDepositDustThreshold
    ) external {
        /* solhint-disable not-rely-on-time */
        self.newDepositDustThreshold = _newDepositDustThreshold;
        self.depositDustThresholdChangeInitiated = block.timestamp;
        emit DepositDustThresholdUpdateStarted(
            _newDepositDustThreshold,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the deposit dust threshold amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositDustThresholdUpdate(Data storage self)
        external
        onlyAfterGovernanceDelay(self, self.depositDustThresholdChangeInitiated)
    {
        emit DepositDustThresholdUpdated(self.newDepositDustThreshold);

        self.newDepositDustThreshold = 0;
        self.depositDustThresholdChangeInitiated = 0;
    }

    /// @notice Get the time deposit dust threshold can be updated.
    /// @return Remaining time in seconds.
    function getRemainingDepositDustThresholdDelayUpdateTime(Data storage self)
        external
        view
        returns (uint256)
    {
        return
            getRemainingChangeTime(
                self,
                self.depositDustThresholdChangeInitiated
            );
    }

    function getNewDepositDustThreshold(Data storage self)
        external
        view
        returns (uint64)
    {
        return self.newDepositDustThreshold;
    }

    /// @notice Begins the deposit treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositTreasuryFeeDivisor New deposit treasury fee divisor amount.
    function beginDepositTreasuryFeeDivisorUpdate(
        Data storage self,
        uint64 _newDepositTreasuryFeeDivisor
    ) external {
        /* solhint-disable not-rely-on-time */
        self.newDepositTreasuryFeeDivisor = _newDepositTreasuryFeeDivisor;
        self.depositTreasuryFeeDivisorChangeInitiated = block.timestamp;
        emit DepositTreasuryFeeDivisorUpdateStarted(
            _newDepositTreasuryFeeDivisor,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the deposit treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositTreasuryFeeDivisorUpdate(Data storage self)
        external
        onlyAfterGovernanceDelay(
            self,
            self.depositTreasuryFeeDivisorChangeInitiated
        )
    {
        emit DepositTreasuryFeeDivisorUpdated(
            self.newDepositTreasuryFeeDivisor
        );

        self.newDepositTreasuryFeeDivisor = 0;
        self.depositTreasuryFeeDivisorChangeInitiated = 0;
    }

    /// @notice Get the time deposit treasury fee divisor can be updated.
    /// @return Remaining time in seconds.
    function getRemainingDepositTreasuryFeeDivisorDelayUpdateTime(
        Data storage self
    ) external view returns (uint256) {
        return
            getRemainingChangeTime(
                self,
                self.depositTreasuryFeeDivisorChangeInitiated
            );
    }

    function getNewDepositTreasuryFeeDivisor(Data storage self)
        external
        view
        returns (uint64)
    {
        return self.newDepositTreasuryFeeDivisor;
    }

    /// @notice Begins the deposit tx max fee amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newDepositTxMaxFee New deposit tx max fee amount.
    function beginDepositTxMaxFeeUpdate(
        Data storage self,
        uint64 _newDepositTxMaxFee
    ) external {
        /* solhint-disable not-rely-on-time */
        self.newDepositTxMaxFee = _newDepositTxMaxFee;
        self.depositTxMaxFeeChangeInitiated = block.timestamp;
        emit DepositTxMaxFeeUpdateStarted(_newDepositTxMaxFee, block.timestamp);
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the deposit tx max fee amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeDepositTxMaxFeeUpdate(Data storage self)
        external
        onlyAfterGovernanceDelay(self, self.depositTxMaxFeeChangeInitiated)
    {
        emit DepositTxMaxFeeUpdated(self.newDepositTxMaxFee);

        self.newDepositTxMaxFee = 0;
        self.depositTxMaxFeeChangeInitiated = 0;
    }

    /// @notice Get the time deposit tx max fee can be updated.
    /// @return Remaining time in seconds.
    function getRemainingDepositTxMaxFeeDelayUpdateTime(Data storage self)
        external
        view
        returns (uint256)
    {
        return
            getRemainingChangeTime(self, self.depositTxMaxFeeChangeInitiated);
    }

    function getNewDepositTxMaxFee(Data storage self)
        external
        view
        returns (uint64)
    {
        return self.newDepositTxMaxFee;
    }

    /// @notice Begins the redemption dust threshold amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionDustThreshold New redemption dust threshold amount.
    function beginRedemptionDustThresholdUpdate(
        Data storage self,
        uint64 _newRedemptionDustThreshold
    ) external {
        /* solhint-disable not-rely-on-time */
        self.newRedemptionDustThreshold = _newRedemptionDustThreshold;
        self.redemptionDustThresholdChangeInitiated = block.timestamp;
        emit RedemptionDustThresholdUpdateStarted(
            _newRedemptionDustThreshold,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the redemption dust threshold amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionDustThresholdUpdate(Data storage self)
        external
        onlyAfterGovernanceDelay(
            self,
            self.redemptionDustThresholdChangeInitiated
        )
    {
        emit RedemptionDustThresholdUpdated(self.newRedemptionDustThreshold);

        self.newRedemptionDustThreshold = 0;
        self.redemptionDustThresholdChangeInitiated = 0;
    }

    /// @notice Get the time redemption dust threshold can be updated.
    /// @return Remaining time in seconds.
    function getRemainingRedemptionDustThresholdDelayUpdateTime(
        Data storage self
    ) external view returns (uint256) {
        return
            getRemainingChangeTime(
                self,
                self.redemptionDustThresholdChangeInitiated
            );
    }

    function getNewRedemptionDustThreshold(Data storage self)
        external
        view
        returns (uint64)
    {
        return self.newRedemptionDustThreshold;
    }

    /// @notice Begins the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner.
    /// @param _newRedemptionTreasuryFeeDivisor New redemption treasury fee divisor amount.
    function beginRedemptionTreasuryFeeDivisorUpdate(
        Data storage self,
        uint64 _newRedemptionTreasuryFeeDivisor
    ) external {
        /* solhint-disable not-rely-on-time */
        self.newRedemptionTreasuryFeeDivisor = _newRedemptionTreasuryFeeDivisor;
        self.redemptionTreasuryFeeDivisorChangeInitiated = block.timestamp;
        emit RedemptionTreasuryFeeDivisorUpdateStarted(
            _newRedemptionTreasuryFeeDivisor,
            block.timestamp
        );
        /* solhint-enable not-rely-on-time */
    }

    /// @notice Finalizes the redemption treasury fee divisor amount update process.
    /// @dev Can be called only by the contract owner, after the governance
    ///      delay elapses.
    function finalizeRedemptionTreasuryFeeDivisorUpdate(Data storage self)
        external
        onlyAfterGovernanceDelay(
            self,
            self.redemptionTreasuryFeeDivisorChangeInitiated
        )
    {
        emit RedemptionTreasuryFeeDivisorUpdated(
            self.newRedemptionTreasuryFeeDivisor
        );

        self.newRedemptionTreasuryFeeDivisor = 0;
        self.redemptionTreasuryFeeDivisorChangeInitiated = 0;
    }

    /// @notice Get the time redemption treasury fee divisor can be updated.
    /// @return Remaining time in seconds.
    function getRemainingRedemptionTreasuryFeeDivisorDelayUpdateTime(
        Data storage self
    ) external view returns (uint256) {
        return
            getRemainingChangeTime(
                self,
                self.redemptionTreasuryFeeDivisorChangeInitiated
            );
    }

    function getNewRedemptionTreasuryFeeDivisor(Data storage self)
        external
        view
        returns (uint64)
    {
        return self.newRedemptionTreasuryFeeDivisor;
    }

    /// @notice Gets the time remaining until the governable parameter update
    ///         can be committed.
    /// @param changeTimestamp Timestamp indicating the beginning of the change.
    /// @return Remaining time in seconds.
    function getRemainingChangeTime(Data storage self, uint256 changeTimestamp)
        internal
        view
        returns (uint256)
    {
        require(changeTimestamp > 0, "Change not initiated");
        /* solhint-disable-next-line not-rely-on-time */
        uint256 elapsed = block.timestamp - changeTimestamp;
        if (elapsed >= self.governanceDelay) {
            return 0;
        }

        return self.governanceDelay - elapsed;
    }
}
