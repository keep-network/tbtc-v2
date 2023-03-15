// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.17;

import "@keep-network/tbtc-v2/contracts/l2/L2WormholeGateway.sol";

/// @notice Wormhole gateway for L2 Arbitrum Upgraded
contract ArbitrumWormholeGatewayUpgraded is L2WormholeGateway {
    string public newVar;

    function initializeV2(string memory _newVar) public {
        newVar = _newVar;
    }
}
