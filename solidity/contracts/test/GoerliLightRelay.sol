// SPDX-License-Identifier: GPL-3.0-only

// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌

pragma solidity 0.8.17;

import "../relay/LightRelay.sol";

/// @title Goerli Light Relay
/// @notice GoerliLightRelay is a stub version of LightRelay intended to be
///         used on the Goerli test network. It always returns `1` as the current
///         and previous difficulties making it possible to bypass validation of
///         difficulties of Bitcoin testnet blocks. Since difficulty in Bitcoin
///         testnet often falls to `1` it would not be possible to validate
///         blocks with the real LightRelay.
/// @dev Since the returned difficulties are fixed and impossible to be modified
///      with any setters, it is safe to use GoerliLightRelay without risking
///      somebody may change the difficulties and block the test network.
///      Notice that GoerliLightRelay is derived from LightRelay so that the two
///      contracts have the same API and correct bindings can be generated.
contract GoerliLightRelay is LightRelay {
    /// @notice Returns `1` as the difficulty of the previous epoch.
    function getPrevEpochDifficulty() external view override returns (uint256) {
        return 1;
    }

    /// @notice Returns `1` as the difficulty of the current epoch.
    function getCurrentEpochDifficulty()
        external
        view
        override
        returns (uint256)
    {
        return 1;
    }
}
