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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Bridge.sol";

/// @title Redemption watchtower
/// @notice This contract encapsulates the logic behind the redemption veto
/// mechanism of the Bridge. The redemption veto mechanism is a safeguard
/// in the event of malicious redemption requests such as those sourced from a
/// Bridge hack. The mechanism involves a permissioned set of Guardians
/// that can object to a redemption request. If a redemption is objected to by
/// an optimistic redemption guardian, it is delayed. Two subsequent objections
/// from redemption guardians results in a veto of the redemption request.
/// A veto returns redeemed amount to the requester while inflicting a freeze
/// penalty on the amount and a financial penalty. The goal of this penalty is
/// to introduce a cost that guards against repeated malicious redemption requests.
contract RedemptionWatchtower is OwnableUpgradeable {
    Bridge public bridge;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(Bridge _bridge) external initializer {
        __Ownable_init();

        bridge = _bridge;
    }
}
