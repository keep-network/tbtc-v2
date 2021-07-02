// SPDX-License-Identifier: MIT

pragma solidity <0.9.0;

import "../token/TBTCToken.sol";

contract ReceiveApprovalStub is IReceiveApproval {
    bool public shouldRevert;

    event ApprovalReceived(
        address from,
        uint256 value,
        address token,
        bytes extraData
    );

    function receiveApproval(
        address from,
        uint256 value,
        address token,
        bytes calldata extraData
    ) external override {
        if (shouldRevert) {
            revert("i am your father luke");
        }

        emit ApprovalReceived(from, value, token, extraData);
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
}
