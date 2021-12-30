// SPDX-License-Identifier: MIT

// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌

pragma solidity 0.8.4;

import "../bank/Bank.sol";

/// @title Bitcoin Bank Vault
/// @notice Vault is a contract extended by applications built on top of the
///         Bank. Vault is locking balances under its own address by
///         transferring the balances to the Vault address and internally
///         bookkeeping the amount of a locked balance per account. This way,
///         each application has a separate Bitcoin balance and problems in
///         a single application are not propagated to other applications or
///         Bank depositors.
contract Vault {
    Bank public bank;

    /// @notice The balance of a given account locked in the Vault.
    ///         Zero by default.
    mapping(address => uint256) public lockedBalance;

    constructor(Bank _bank) {
        require(
            address(_bank) != address(0),
            "Bank can not be the zero address"
        );
        bank = _bank;
    }

    /// @notice Transfers the given `amount` of the Bank balance from `spender`
    ///         to the Vault and locks this balance under `spender`'s account.
    /// @dev Vault must have an allowance for `spender`'s balance for at least
    ///      `amount`.
    function lockBalance(address spender, uint256 amount) internal {
        require(
            bank.balanceOf(spender) >= amount,
            "Amount exceeds balance in the bank"
        );
        lockedBalance[spender] += amount;
        bank.transferBalanceFrom(spender, address(this), amount);
    }

    /// @notice Unlocks the given `amount` and transfers it back to `recipient`
    ///         balance in the Bank.
    /// @dev `recipient` must have at least `amount` locked in the Vault.
    function unlockBalance(address recipient, uint256 amount) internal {
        require(
            lockedBalance[recipient] >= amount,
            "Amount exceeds locked balance"
        );
        lockedBalance[recipient] -= amount;
        bank.transferBalance(recipient, amount);
    }
}
