// SPDX-License-Identifier: GPL-3.0-only

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

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

/**
 * @title IL2TBTC
 * @notice Interface for interacting with the L2TBTC token contract.
 *
 * Exposes all public or external functions and state variables
 * from the `L2TBTC` implementation in an interface form.
 */
interface IL2TBTC is IERC20Upgradeable, IERC20PermitUpgradeable {
    //-------------------------------------------------------------------------
    // Mint/Burn
    //-------------------------------------------------------------------------

    /// @notice Mints `amount` tokens to `account` (only callable by a minter).
    function mint(address account, uint256 amount) external;

    /// @notice Burns `amount` tokens from `account` using the caller’s allowance.
    function burnFrom(address account, uint256 amount) external;
}
