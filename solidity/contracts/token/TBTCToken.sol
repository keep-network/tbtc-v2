// SPDX-License-Identifier: MIT

pragma solidity <0.9.0;

import "./ERC20WithPermit.sol";

contract TBTCToken is ERC20WithPermit {
    constructor() ERC20WithPermit("TBTC v2 migration", "TBTC") {}
}
