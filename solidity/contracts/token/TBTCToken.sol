// SPDX-License-Identifier: MIT

pragma solidity <0.9.0;

import "./ERC20WithPermit.sol";
import "./MisfundRecovery.sol";

contract TBTCToken is ERC20WithPermit, MisfundRecovery {
    constructor() ERC20WithPermit("TBTC v2 migration", "TBTC") {}
}
