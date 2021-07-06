// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

/// @notice An interface that should be implemented by contracts supporting
///         `approveAndCall`/`receiveApproval` pattern.
interface IReceiveApproval {
    function receiveApproval(
        address from,
        uint256 value,
        address token,
        bytes calldata extraData
    ) external;
}
