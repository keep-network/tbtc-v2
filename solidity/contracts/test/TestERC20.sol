// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../token/ERC20WithPermit.sol";

contract TestERC20 is ERC20WithPermit {
    string public constant NAME = "Test ERC20 Token";
    string public constant SYMBOL = "TT";

    constructor() ERC20WithPermit(NAME, SYMBOL) {}
}
