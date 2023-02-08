// SPDX-License-Identifier: GPL-3.0-only

pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../token/TBTC.sol";

/// @title VendingMachineV2
/// @notice VendingMachineV2 is used to exchange TBTC v1 and TBTC v2 tokens in
///         a 1:1 ratio during and after the process of TBTC v1 bridge
///         sunsetting. The redeemer selected by the DAO based on the "TIP-027b
///         tBTC v1: The Sunsetting" proposal will deposit TBTC v2 tokens into
///         VendingMachineV2 so that outstanding TBTC v1 token owners can
///         upgrade to TBTC v2 tokens. The redeemer will withdraw the TBTC v1
///         tokens deposited into the contract to perform TBTC v1 redemptions.
///         After a certain deadline, when no more TBTC v1 can be obtained, the
///         redeemer will renounce the ownership of the contract. TBTC v1 bridge
///         operators will seize BTC, mint TBTC v2 tokens, and deposit TBTC v2
///         tokens into the VendingMachineV2. The DAO will refund their ETH
///         collateral loss. The remaining TBTC v1 token owners will be able to
///         use VendingMachineV2 to upgrade to TBTC v2 tokens forever, without
///         a deadline.  TBTC v1 tokens will remain locked in the contract
///         forever. This way, all TBTC v1, and TBTC v2 on the market will
///         always be backed by BTC.
contract VendingMachineV2 is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for TBTC;

    IERC20 public immutable tbtcV1;
    TBTC public immutable tbtcV2;

    event Exchanged(address indexed to, uint256 amount);
    event Deposited(address from, uint256 amount);
    event Withdrawn(address token, address to, uint256 amount);

    constructor(IERC20 _tbtcV1, TBTC _tbtcV2) {
        tbtcV1 = _tbtcV1;
        tbtcV2 = _tbtcV2;
    }

    /// @notice Exchange TBTC v1 for TBTC v2 in a 1:1 ratio.
    ///         The caller needs to have at least `amount` of TBTC v1 balance
    ///         approved for transfer to the `VendingMachineV2` before calling
    ///         this function.
    /// @param amount The amount of TBTC v1 to exchange for TBTC v2.
    function exchange(uint256 amount) external {
        _exchange(msg.sender, amount);
    }

    /// @notice Exchange TBTC v1 for TBTC v2 in a 1:1 ratio.
    ///         The caller needs to have at least `amount` of TBTC v1 balance
    ///         approved for transfer to the `VendingMachineV2` before calling
    ///         this function.
    /// @dev This function is a shortcut for approve + mint. Only TBTC v1
    ///      caller is allowed and only TBTC v1 is allowed as a token to
    ///      transfer.
    /// @param from TBTC v1 token holder exchanging TBTC v1 to TBTC v2.
    /// @param amount The amount of TBTC v1 to exchange for TBTC v2.
    /// @param token TBTC v1 token address.
    function receiveApproval(
        address from,
        uint256 amount,
        address token,
        bytes calldata
    ) external {
        require(token == address(tbtcV1), "Token is not TBTC v1");
        require(msg.sender == address(tbtcV1), "Only TBTC v1 caller allowed");
        _exchange(from, amount);
    }

    /// @notice Allows to deposit TBTC v2 tokens to the contract.
    ///         VendingMachineV2 can not mint TBTC v2 tokens so TBTC v2 needs
    ///         to be deposited into the contract so that TBTC v1 to TBTC v2
    ///         exchange can happen.
    ///         The caller needs to have at least `amount` of TBTC v2 balance
    ///         approved for transfer to the `VendingMachineV2` before calling
    ///         this function.
    /// @dev This function is for the redeemer and TBTC v1 operators. This is
    ///      NOT a function for TBTC v1 token holders.
    /// @param amount The amount of TBTC v2 to deposit into the contract.
    function depositTbtcV2(uint256 amount) external {
        emit Deposited(msg.sender, amount);
        tbtcV2.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Allows the contract owner to withdraw tokens. This function is
    ///         used in two cases: 1) when the redeemer wants to redeem TBTC v1
    ///         tokens to perform TBTC v2 redemptions; 2) when the deadline for
    ///         TBTC v1 > TBTC v2 exchange passed and the redeemer wants their
    ///         TBTC v2 back. Once the redeemer renounces the ownership of the
    ///         contract, no one will be able to call this function.
    /// @dev This function is for the redeemer. This is NOT a function for
    ///      TBTC v1 token holders.
    /// @param token The address of a token to withdraw.
    /// @param recipient The address which should receive withdrawn tokens.
    /// @param amount The amount wo withdraw.
    function withdrawFunds(
        IERC20 token,
        address recipient,
        uint256 amount
    ) external onlyOwner {
        emit Withdrawn(address(token), recipient, amount);
        token.safeTransfer(recipient, amount);
    }

    function _exchange(address tokenOwner, uint256 amount) internal {
        emit Exchanged(tokenOwner, amount);
        tbtcV1.safeTransferFrom(tokenOwner, address(this), amount);

        require(
            tbtcV2.balanceOf(address(this)) >= amount,
            "Not enough TBTC v2 available in the Vending Machine"
        );
        tbtcV2.safeTransfer(tokenOwner, amount);
    }
}
