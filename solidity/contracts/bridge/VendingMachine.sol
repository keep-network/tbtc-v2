// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../token/TBTCToken.sol";

contract VendingMachine is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public tbtcV1;
    TBTCToken public tbtcV2;

    event Minted(address recipient, uint256 amount);

    constructor(IERC20 _tbtcV1, TBTCToken _tbtcV2) {
        tbtcV1 = _tbtcV1;
        tbtcV2 = _tbtcV2;
    }

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function receiveApproval(
        address from,
        uint256 amount,
        address token,
        bytes calldata
    ) external {
        require(token == address(tbtcV1), "Token is not TBTC v1");
        require(msg.sender == address(tbtcV1), "Only TBTC v1 caller allowed");
        _mint(from, amount);
    }

    function _mint(address tokenOwner, uint256 amount) internal {
        tbtcV1.safeTransferFrom(tokenOwner, address(this), amount);
        tbtcV2.mint(tokenOwner, amount);
        emit Minted(tokenOwner, amount);
    }
}
