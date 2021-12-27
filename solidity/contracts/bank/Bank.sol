// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Bank is Ownable {
    address public bridge;

    /// @notice The balance of the given account in the Bank.
    mapping(address => uint256) public balanceOf;

    event BalanceTransferred(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    modifier onlyBridge() {
        require(msg.sender == address(bridge), "Caller is not the bridge");
        _;
    }

    function updateBridge(address _bridge) external onlyOwner {
        bridge = _bridge;
    }

    function transferBalance(address recipient, uint256 amount) external {
        _transferBalance(msg.sender, recipient, amount);
    }

    function increaseBalances(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        for (uint256 i = 0; i < recipients.length; i++) {
            increaseBalance(recipients[i], amounts[i]);
        }
    }

    function decreaseBalances(
        address[] calldata spenders,
        uint256[] calldata amounts
    ) external {
        for (uint256 i = 0; i < spenders.length; i++) {
            decreaseBalance(spenders[i], amounts[i]);
        }
    }

    function increaseBalance(address recipient, uint256 amount)
        public
        onlyBridge
    {
        require(
            recipient != address(this),
            "Can not increase balance for Bank"
        );
        balanceOf[recipient] += amount;
    }

    function decreaseBalance(address spender, uint256 amount)
        public
        onlyBridge
    {
        balanceOf[spender] -= amount;
    }

    function _transferBalance(
        address spender,
        address recipient,
        uint256 amount
    ) private {
        require(
            recipient != address(0),
            "Can not transfer to the zero address"
        );
        require(
            recipient != address(this),
            "Can not transfer to the Bank address"
        );

        uint256 spenderBalance = balanceOf[spender];
        require(spenderBalance >= amount, "Transfer amount exceeds balance");
        balanceOf[spender] = spenderBalance - amount;
        balanceOf[recipient] += amount;
        emit BalanceTransferred(spender, recipient, amount);
    }
}
