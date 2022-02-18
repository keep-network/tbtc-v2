// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../bank/Bank.sol";

contract BankStub is Bank {
    function setBalance(address addr, uint256 amount) external {
        balanceOf[addr] = amount;
    }
}
