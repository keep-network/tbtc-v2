// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.17;

import "./interfaces/ITokenBridge.sol";

/// @notice This contract acts as a vending machine converting
///         'wormholeArbitrumTBTC <-> arbitrumTBTC'
// TODO: inherit from a generic L2WormholeGateway
contract ArbitrumWormholeGateway {
    ITokenBridge public tokenBridge;

    function initialize(address wormholeTokenBridgeAddress) external {
        tokenBridge = ITokenBridge(wormholeTokenBridgeAddress);
    }
}
