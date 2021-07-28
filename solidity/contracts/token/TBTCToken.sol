// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@thesis/solidity-contracts/contracts/token/ERC20WithPermit.sol";
import "./MisfundRecovery.sol";

contract TBTCToken is ERC20WithPermit, MisfundRecovery {
    constructor() ERC20WithPermit("TBTC v2", "TBTC") {}
}
