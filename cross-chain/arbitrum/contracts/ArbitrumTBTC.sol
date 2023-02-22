// SPDX-License-Identifier: GPL-3.0-only

pragma solidity 0.8.17;

import "./L2TBTC.sol";

contract ArbitrumTBTC is L2TBTC {
    function initialize() external {
        initialize("ArbitrumTBTC", "arbitrumTBTC"); // TODO: what should we name it?
    }
}