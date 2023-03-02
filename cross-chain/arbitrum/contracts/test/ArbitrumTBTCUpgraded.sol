// Test contract to check upgradeability functionality.

// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.17;

import "@keep-network/tbtc-v2/contracts/l2/L2TBTC.sol";

/// @notice Canonical tBTC Token on Arbitrum Upgraded
contract ArbitrumTBTCUpgraded is L2TBTC {
    string public newVar;

    function initializeV2(string memory _newVar) public {
        newVar = _newVar;
    }
}
