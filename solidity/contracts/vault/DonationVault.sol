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

pragma solidity ^0.8.9;

import "./IVault.sol";
import "../bank/Bank.sol";

/// @title BTC donation vault
/// @notice Vault that allows making BTC donations to the system. Upon deposit,
///         this vault does not increase depositors' tBTC balances and always
///         decreases its own tBTC balance in the same transaction.
///
///         BEWARE: ALL BTC DEPOSITS TARGETING THIS VAULT ARE NOT REDEEMABLE AND
///         THERE IS NO WAY TO RESTORE THE TBTC BALANCE! DO NOT DEPOSIT AGAINST
///         THIS VAULT UNLESS YOU REALLY KNOW WHAT YOU ARE DOING!
contract DonationVault is IVault {
    Bank public bank;

    event DonationReceived(address[] depositors, uint256[] depositedAmounts);

    modifier onlyBank() {
        require(msg.sender == address(bank), "Caller is not the Bank");
        _;
    }

    constructor(Bank _bank) {
        require(
            address(_bank) != address(0),
            "Bank can not be the zero address"
        );

        bank = _bank;
    }

    /// @notice Function not supported by the `DonationVault`. Always reverts.
    function receiveBalanceApproval(address, uint256)
        external
        override
        onlyBank
    {
        revert("Donation vault cannot receive balance approval");
    }

    /// @notice Ignores the deposited amounts and does not increase depositors'
    ///         individual tBTC balances. Decreases its own tBTC balance
    ///         in the Bank by the total deposited amount.
    /// @dev Requirements:
    ///      - Can only be called by the Bank after the Bridge swept deposits
    ///        and Bank increased balance for the vault.
    ///      - The `depositors` array must not be empty.
    ///      - The `depositors` array length must be equal to the
    ///        `depositedAmounts` array length.
    function receiveBalanceIncrease(
        address[] calldata depositors,
        uint256[] calldata depositedAmounts
    ) external override onlyBank {
        require(depositors.length != 0, "No depositors specified");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < depositors.length; i++) {
            totalAmount += depositedAmounts[i];
        }

        emit DonationReceived(depositors, depositedAmounts);

        bank.decreaseBalance(totalAmount);
    }
}
