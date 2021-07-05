// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./ERC20WithPermit.sol";
import "./MisfundRecovery.sol";

interface IReceiveApproval {
    function receiveApproval(
        address _from,
        uint256 _value,
        address _token,
        bytes calldata _extraData
    ) external;
}

contract TBTCToken is ERC20WithPermit, MisfundRecovery {
    constructor() ERC20WithPermit("TBTC v2 migration", "TBTC") {}

    /// @notice Executes receiveApproval function on spender as specified in
    ///         IReceiveApproval interface. Approves spender to withdraw from
    ///         the caller multiple times, up to the value amount. If this
    ///         function is called again, it overwrites the current allowance
    ///         with value. Reverts if the approval reverted or if
    ///         receiveApproval call on the spender reverted.
    function approveAndCall(
        address spender,
        uint256 value,
        bytes memory extraData
    ) external returns (bool) {
        if (approve(spender, value)) {
            IReceiveApproval(spender).receiveApproval(
                msg.sender,
                value,
                address(this),
                extraData
            );
            return true;
        }
    }
}
