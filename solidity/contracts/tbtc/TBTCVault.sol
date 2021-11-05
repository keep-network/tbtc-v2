// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../bank/IVault.sol";
import "../bank/Vault.sol";
import "../token/TBTC.sol";

contract TBTCVault is Vault, IQuickLock {
    TBTC public token;

    constructor(Bank _bank) Vault(_bank) {}

    function quickLock(address owner, uint256 amount) external override {
        mint(owner, amount);
    }

    function redeem(
        uint256 amount,
        bytes8 outputValueBytes,
        bytes memory redeemerOutputScript
    ) external {
        redeemBalance(
            msg.sender,
            amount,
            outputValueBytes,
            redeemerOutputScript
        );
        token.burnFrom(msg.sender, amount);
    }

    function mint(address owner, uint256 amount) public {
        lockBalance(owner, amount);
        token.mint(owner, amount);
    }
}
