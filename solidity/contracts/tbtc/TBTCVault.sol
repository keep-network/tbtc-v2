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

import "../bank/Vault.sol";
import "../token/TBTC.sol";

/// @title TBTC application vault
/// @notice TBTC is a fully Bitcoin-backed ERC-20 token pegged to the price of
///         Bitcoin. It facilitates Bitcoin holders to act on the Ethereum
///         blockchain and access the decentralized finance (DeFi) ecosystem.
///         Vault mints and redeems TBTC based on Bitcoin balances in the Bank.
/// @dev TBTCVault is the owner of TBTC token contract and is the only contract
///      minting the token.
contract TBTCVault is Vault {
    TBTC public tbtcToken;

    event Minted(address indexed to, uint256 amount);

    event Redeemed(address indexed from, uint256 amount);

    constructor(Bank _bank, TBTC _tbtcToken) Vault(_bank) {
        require(
            address(_tbtcToken) != address(0),
            "TBTC token can not be the zero address"
        );

        tbtcToken = _tbtcToken;
    }

    /// @notice Transfers the given `amount` of the Bank balance from caller
    ///         to TBTC Vault, locks this balance under caller's account, and
    ///         mints `amount` of TBTC to the caller.
    /// @dev TBTC Vault must have an allowance for caller's balance for at
    ///      least `amount`.
    /// @param amount Amount of TBTC to mint
    function mint(uint256 amount) external {
        emit Minted(msg.sender, amount);
        lockBalance(msg.sender, amount);
        tbtcToken.mint(msg.sender, amount);
    }

    /// @notice Unlocks the given `amount` and transfers it back to the caller's
    ///         balance in the Bank. Burns `amount` of TBTC from the caller's
    ///         account.
    /// @dev Caller must have at least `amount` of TBTC approved to
    ///       TBTC Vault.
    /// @param amount Amount of TBTC to redeem
    function redeem(uint256 amount) external {
        _redeem(msg.sender, amount);
    }

    /// @notice Unlocks the given `amount` and transfers it back to the caller's
    ///         balance in the Bank. Burns `amount` of TBTC from the caller's
    ///         account.
    /// @dev This function is doing the same as `reedeem` but it allows to
    ///      execute redemption without an additional approval transaction.
    ///      The function can be called only via `approveAndCall` of TBTC token.
    /// @param from TBTC token holder executing redemption
    /// @param amount Amount of TBTC to redeem
    /// @param token TBTC token address
    function receiveApproval(
        address from,
        uint256 amount,
        address token,
        bytes calldata
    ) external {
        require(token == address(tbtcToken), "Token is not TBTC");
        require(msg.sender == token, "Only TBTC caller allowed");
        _redeem(from, amount);
    }

    function _redeem(address from, uint256 amount) internal {
        emit Redeemed(from, amount);
        tbtcToken.burnFrom(from, amount);
        unlockBalance(from, amount);
    }
}
