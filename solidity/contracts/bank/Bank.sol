// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IVault.sol";
import "../bridge/IBridge.sol";

contract Bank is Ownable {
    mapping(address => uint256) public balance;
    mapping(address => mapping(address => uint256)) public allowance;

    IBridge public bridge;

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event Transfer(address indexed from, address indexed to, uint256 value);

    modifier onlyBridge() {
        require(msg.sender == address(bridge), "Caller is not the bridge");
        _;
    }

    function setBridge(IBridge newBridge) external onlyOwner {
        bridge = newBridge;
    }

    function increaseBalance(address owner, uint256 amount)
        external
        onlyBridge
    {
        balance[owner] += amount;
    }

    function quickLock(
        address owner,
        uint256 amount,
        address vault
    ) external onlyBridge {
        balance[owner] += amount;
        _approve(owner, vault, amount);
        IQuickLock(vault).quickLock(owner, amount);
    }

    function decreaseBalance(address owner, uint256 amount)
        external
        onlyBridge
    {
        balance[owner] -= amount;
    }

    function approve(address spender, uint256 amount) external {
        _approve(msg.sender, spender, amount);
    }

    // TODO: approveAndCall?
    // TODO: EIP2612 approval?

    function transfer(address recipient, uint256 amount) external {
        _transfer(msg.sender, recipient, amount);
    }

    function transferFrom(
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

            _approve(spender, msg.sender, currentAllowance - amount);
        }

        _transfer(spender, recipient, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) private {
        require(owner != address(0), "Approve from the zero address");
        require(spender != address(0), "Approve to the zero address");

        allowance[owner][spender] = amount;

        emit Approval(owner, spender, amount);
    }

    function _transfer(
        address spender,
        address recipient,
        uint256 amount
    ) private {
        require(spender != address(0), "Transfer from the zero address");
        require(recipient != address(0), "Transfer to the zero address");
        require(recipient != address(this), "Transfer to bank not allowed");

        uint256 spenderBalance = balance[spender];
        require(
            spenderBalance >= amount,
            "Transfer amount exceeds swept balance"
        );

        balance[spender] -= amount;
        balance[recipient] += amount;

        emit Transfer(spender, recipient, amount);
    }
}
