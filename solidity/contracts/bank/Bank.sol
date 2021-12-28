// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Bank is Ownable {
    address public bridge;

    /// @notice The balance of the given account in the Bank. Zero by default.
    mapping(address => uint256) public balanceOf;

    /// @notice The remaining amount of balance that spender will be
    ///         allowed to transfer on behalf of owner through `transferFrom`.
    ///         Zero by default.
    mapping(address => mapping(address => uint256)) public allowance;

    event BalanceTransferred(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    event BalanceApproved(
        address indexed owner,
        address indexed spender,
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

    function approveBalance(address spender, uint256 amount) external {
        _approveBalance(msg.sender, spender, amount);
    }

    function transferBalanceFrom(
        address spender,
        address recipient,
        uint256 amount
    ) external {
        uint256 currentAllowance = allowance[spender][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(
                currentAllowance >= amount,
                "Transfer amount exceeds allowance"
            );
            _approveBalance(spender, msg.sender, currentAllowance - amount);
        }
        _transferBalance(spender, recipient, amount);
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

    function _approveBalance(
        address owner,
        address spender,
        uint256 amount
    ) private {
        require(spender != address(0), "Can not approve to the zero address");
        allowance[owner][spender] = amount;
        emit BalanceApproved(owner, spender, amount);
    }
}
