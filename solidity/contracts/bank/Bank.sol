// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Bank is Ownable {
    address public bridge;

    /// @notice The balance of the given account in the Bank.
    mapping(address => uint256) public balanceOf;

    modifier onlyBridge() {
        require(msg.sender == address(bridge), "Caller is not the bridge");
        _;
    }

    function updateBridge(address _bridge) external onlyOwner {
        bridge = _bridge;
    }

    function increaseBalance(address recipient, uint256 amount)
        external
        onlyBridge
    {
        require(
            recipient != address(this),
            "Bank itself can not have a balance"
        );
        balanceOf[recipient] += amount;
    }

    function decreaseBalance(address spender, uint256 amount)
        external
        onlyBridge
    {
        balanceOf[spender] -= amount;
    }
}
