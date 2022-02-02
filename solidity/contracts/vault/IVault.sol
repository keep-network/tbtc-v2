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

/// @title Bank Vault interface
/// @notice `IVault` is an interface for a smart contract consuming Bank
///         balances of other contracts or externally owned accounts (EOA).
interface IVault {
    /// @notice Called by the Bank in `approveBalanceAndCall` function after
    ///         the balance `owner` approved `amount` of their balance in the
    ///         Bank for the vault. This way, the depositor can approve balance
    ///         and call the vault to use the approved balance in a single
    ///         transaction.
    /// @param owner Address of the Bank balance owner who approved their
    ///        balance to be used by the vault
    /// @param amount The amount of the Bank balance approved by the owner
    ///        to be used by the vault
    // @dev The implementation must ensure this function can only be called
    ///      by the Bank. The Bank does _not_ guarantee that the `amount`
    ///      approved by the `owner` currently exists on their balance. That is,
    ///      the `owner` could approve more balance than they currently have.
    ///      This works the same as `Bank.approve` function. The vault must
    ///      ensure the actual balance is checked before performing any action
    ///      based on it.
    function receiveBalanceApproval(address owner, uint256 amount) external;

    /// @notice Called by the Bank in `increaseBalanceAndCall` function after
    ///         increasing the balance in the Bank for the vault. It happens in
    ///         the same transaction in which deposits were swept by the Bridge.
    ///         This allows the depositor to route their deposit revealed to the
    ///         Bridge to the particular smart contract (vault) in the same
    ///         transaction in which the deposit is revealed. This way, the
    ///         depositor does not have to execute additional transaction after
    ///         the deposit gets swept by the Bridge to approve and transfer
    ///         their balance to the vault.
    /// @param depositors Addresses of depositors whose deposits have been swept
    /// @param depositedAmounts Amounts deposited by individual depositors and
    ///        swept
    /// @dev The implementation must ensure this function can only be called
    ///      by the Bank. The Bank guarantees that the vault's balance was
    ///      increased by the sum of all deposited amounts before this function
    ///      is called, in the same transaction.
    function receiveBalanceIncrease(
        address[] calldata depositors,
        uint256[] calldata depositedAmounts
    ) external;
}
