// SPDX-License-Identifier: GPL-3.0-only

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

pragma solidity ^0.8.0;

import "../bridge/BitcoinTx.sol";
import "../bridge/Deposit.sol";

/// @notice Interface of the Bridge contract.
/// @dev See bridge/Bridge.sol
interface IBridge {
    /// @dev See {Bridge#revealDepositWithExtraData}
    function revealDepositWithExtraData(
        BitcoinTx.Info calldata fundingTx,
        Deposit.DepositRevealInfo calldata reveal,
        bytes32 extraData
    ) external;

    /// @dev See {Bridge#deposits}
    function deposits(uint256 depositKey)
        external
        view
        returns (Deposit.DepositRequest memory);

    /// @dev See {Bridge#depositParameters}
    function depositParameters()
        external
        view
        returns (
            uint64 depositDustThreshold,
            uint64 depositTreasuryFeeDivisor,
            uint64 depositTxMaxFee,
            uint32 depositRevealAheadPeriod
        );
}
