// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./Bank.sol";

contract Vault {
    Bank public bank;
    mapping(address => uint256) public lockedBalance;

    constructor(Bank _bank) {
        require(
            address(_bank) != address(0),
            "Bank can not be the zero address"
        );
        bank = _bank;
    }

    function lockBalance(address owner, uint256 amount) internal {
        bank.transferFrom(owner, address(this), amount);
        lockedBalance[owner] += amount;
    }

    function unlockBalance(address owner, uint256 amount) internal {
        bank.transferFrom(address(this), owner, amount);
        lockedBalance[owner] -= amount;
    }

    function redeemBalance(
        address owner,
        uint256 amount,
        bytes8 outputValueBytes,
        bytes memory redeemerOutputScript
    ) internal {
        require(
            lockedBalance[owner] >= amount,
            "Redeem amount exceeds balance"
        );
        bank.bridge().redeem(amount, outputValueBytes, redeemerOutputScript);
    }
}
