// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.17;

import "@keep-network/tbtc-v2/contracts/l2/L2WormholeGateway.sol";

/// @notice Wormhole gateway for L2 Polygon - upgraded version.
/// @dev This contract is intended solely for testing purposes. As it currently
///      stands in the implementation of L2WormholeGateway.sol, there are no
///      reserved storage gap slots available, thereby limiting the upgradability
///      to a child contract only.
contract PolygonWormholeGatewayUpgraded is L2WormholeGateway {
    string public newVar;

    function initializeV2(string memory _newVar) public {
        newVar = _newVar;
    }
}
