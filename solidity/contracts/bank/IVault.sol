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
///         balances allowing the smart contract to receive Bank balances right
///         after sweeping the deposit by the Bridge. This method allows the
///         depositor to route their deposit revealed to the Bridge to the
///         particular smart contract in the same transaction the deposit is
///         revealed. This way, the depositor does not have to execute
///         additional transaction after the deposit gets swept by the Bridge.
interface IVault {
    /// @notice Called by the Bank in `increaseBalanceAndCall` function after
    ///         increasing the balance in the Bank for the vault.
    /// @param depositors Addresses of depositors whose deposits have been swept
    /// @param depositedAmounts Amounts deposited by individual depositors and
    ///        swept
    /// @dev The implementation must ensure this function can only be called
    ///      by the Bank.
    function onBalanceIncreased(
        address[] calldata depositors,
        uint256[] calldata depositedAmounts
    ) external;
}
