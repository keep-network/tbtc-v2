// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@thesis/solidity-contracts/contracts/token/ERC20WithPermit.sol";
import "@thesis/solidity-contracts/contracts/token/MisfundRecovery.sol";

contract TBTC is ERC20WithPermit, MisfundRecovery {
    constructor() ERC20WithPermit("tBTC v2", "tBTC") {}
}
