// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../bank/Vault.sol";
import "../token/TBTC.sol";

contract VaultStub is Vault {
    constructor(Bank _bank) Vault(_bank) {}

    function publicLockBalance(address spender, uint256 amount) public {
        super.lockBalance(spender, amount);
    }

    function publicUnlockBalance(address recipient, uint256 amount) public {
        super.unlockBalance(recipient, amount);
    }
}
