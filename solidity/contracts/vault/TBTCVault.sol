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
import "../token/TBTC.sol";

/// @title TBTC application vault
/// @notice TBTC is a fully Bitcoin-backed ERC-20 token pegged to the price of
///         Bitcoin. It facilitates Bitcoin holders to act on the Ethereum
///         blockchain and access the decentralized finance (DeFi) ecosystem.
///         TBTC Vault mints and redeems TBTC based on Bitcoin balances in the
///         Bank.
/// @dev TBTC Vault is the owner of TBTC token contract and is the only contract
///      minting the token.
contract TBTCVault is IVault {
    Bank public bank;
    TBTC public tbtcToken;

    event Minted(address indexed to, uint256 amount);

    event Redeemed(address indexed from, uint256 amount);

    modifier onlyBank() {
        require(msg.sender == address(bank), "Caller is not the Bank");
        _;
    }

    constructor(Bank _bank, TBTC _tbtcToken) {
        require(
            address(_bank) != address(0),
            "Bank can not be the zero address"
        );

        require(
            address(_tbtcToken) != address(0),
            "TBTC token can not be the zero address"
        );

        bank = _bank;
        tbtcToken = _tbtcToken;
    }

    /// @notice Transfers the given `amount` of the Bank balance from caller
    ///         to TBTC Vault, and mints `amount` of TBTC to the caller.
    /// @dev TBTC Vault must have an allowance for caller's balance in the Bank
    ///      for at least `amount`.
    /// @param amount Amount of TBTC to mint
    function mint(uint256 amount) external {
        address minter = msg.sender;
        require(
            bank.balanceOf(minter) >= amount,
            "Amount exceeds balance in the bank"
        );
        _mint(minter, amount);
        bank.transferBalanceFrom(minter, address(this), amount);
    }

    /// @notice Transfers the given `amount` of the Bank balance from the caller
    ///         to TBTC Vault and mints `amount` of TBTC to the caller.
    /// @dev Can only be called by the Bank via `approveBalanceAndCall`.
    /// @param owner The owner who approved their Bank balance
    /// @param amount Amount of TBTC to mint
    function receiveBalanceApproval(address owner, uint256 amount)
        external
        override
        onlyBank
    {
        require(
            bank.balanceOf(owner) >= amount,
            "Amount exceeds balance in the bank"
        );
        _mint(owner, amount);
        bank.transferBalanceFrom(owner, address(this), amount);
    }

    /// @notice Mints the same amount of TBTC as the deposited amount for each
    ///         depositor in the array. Can only be called by the Bank after the
    ///         Bridge swept deposits and Bank increased balance for the
    ///         vault.
    /// @dev Fails if `depositors` array is empty. Expects the length of
    ///      `depositors` and `depositedAmounts` is the same.
    function receiveBalanceIncrease(
        address[] calldata depositors,
        uint256[] calldata depositedAmounts
    ) external override onlyBank {
        require(depositors.length != 0, "No depositors specified");
        for (uint256 i = 0; i < depositors.length; i++) {
            _mint(depositors[i], depositedAmounts[i]);
        }
    }

    /// @notice Burns `amount` of TBTC from the caller's account and transfers
    ///         `amount` back to the caller's balance in the Bank.
    /// @dev Caller must have at least `amount` of TBTC approved to
    ///       TBTC Vault.
    /// @param amount Amount of TBTC to redeem
    ///
    /// TODO: Update the docs after introducing redemption approval.
    function redeem(uint256 amount, bytes calldata extraData) external {
        _redeem(msg.sender, amount, extraData);
    }

    /// @notice Burns `amount` of TBTC from the caller's account and transfers
    ///         `amount` back to the caller's balance in the Bank.
    /// @dev This function is doing the same as `redeem` but it allows to
    ///      execute redemption without an additional approval transaction.
    ///      The function can be called only via `approveAndCall` of TBTC token.
    /// @param from TBTC token holder executing redemption
    /// @param amount Amount of TBTC to redeem
    /// @param token TBTC token address
    /// @param extraData Additional data passed by the `approveAndCall` function
    ///
    /// TODO: Update the docs after introducing redemption approval.
    function receiveApproval(
        address from,
        uint256 amount,
        address token,
        bytes calldata extraData
    ) external {
        require(token == address(tbtcToken), "Token is not TBTC");
        require(msg.sender == token, "Only TBTC caller allowed");
        _redeem(from, amount, extraData);
    }

    // slither-disable-next-line calls-loop
    function _mint(address minter, uint256 amount) internal {
        emit Minted(minter, amount);
        tbtcToken.mint(minter, amount);
    }

    function _redeem(
        address redeemer,
        uint256 amount,
        bytes calldata extraData
    ) internal {
        emit Redeemed(redeemer, amount);
        tbtcToken.burnFrom(redeemer, amount);
        bank.transferBalance(redeemer, amount);

        if (extraData.length > 0) {
            bank.approveBalanceRedemption(redeemer, amount, extraData);
        }
    }
}
