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
///         mechanism of the Bridge. The redemption veto mechanism is a safeguard
///         in the event of malicious redemption requests such as those sourced
///         from a Bridge hack. The mechanism involves a permissioned set of
///         Guardians that can object to a redemption request. If a redemption
///         is objected to by a redemption guardian, it is delayed. Two
///         subsequent objections from redemption guardians results in a veto
///         of the redemption request. A veto returns redeemed amount to the
///         requester while inflicting a freeze and financial penalty on the
///         amount. The goal of this penalty is to introduce a cost that guards
///         against repeated malicious redemption requests.
contract RedemptionWatchtower is OwnableUpgradeable {
    /// @notice Set of redemption guardians.
    mapping(address => bool) public isGuardian;
    /// @notice The Bridge contract.
    Bridge public bridge;
    // UNIX timestamp the redemption watchtower (and veto mechanism) was enabled at.
    // XXX: Unsigned 32-bit int unix seconds, will break February 7th 2106.
    uint32 public watchtowerEnabledAt;
    /// @notice Address of the manager responsible for parameters management.
    address public manager;

    event WatchtowerEnabled(uint32 enabledAt, address manager);

    event GuardianAdded(address indexed guardian);

    event GuardianRemoved(address indexed guardian);

    modifier onlyManager() {
        require(msg.sender == manager, "Caller is not watchtower manager");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(Bridge _bridge) external initializer {
        __Ownable_init();

        bridge = _bridge;
    }

    /// @notice Enables the redemption watchtower and veto mechanism.
    /// @param _manager Address of the watchtower manager.
    /// @param _guardians List of initial guardian addresses.
    /// @dev Requirements:
    ///      - The caller must be the owner,
    ///      - Watchtower must not be enabled already,
    ///      - Manager address must not be zero.
    function enableWatchtower(address _manager, address[] calldata _guardians)
        external
        onlyOwner
    {
        require(watchtowerEnabledAt == 0, "Already enabled");

        require(_manager != address(0), "Manager address must not be 0x0");
        manager = _manager;

        for (uint256 i = 0; i < _guardians.length; i++) {
            _addGuardian(_guardians[i]);
        }

        /* solhint-disable-next-line not-rely-on-time */
        uint32 enabledAt = uint32(block.timestamp);
        watchtowerEnabledAt = enabledAt;

        emit WatchtowerEnabled(enabledAt, _manager);
    }

    /// @notice Adds a redemption guardian
    /// @param guardian Address of the guardian to add.
    /// @dev Requirements:
    ///      - The caller must be the watchtower manager,
    ///      - The guardian must not already exist.
    function addGuardian(address guardian) external onlyManager {
        _addGuardian(guardian);
    }

    /// @notice Adds a redemption guardian
    /// @param guardian Address of the guardian to add.
    /// @dev Requirements:
    ///      - The guardian must not already exist.
    function _addGuardian(address guardian) internal {
        require(!isGuardian[guardian], "Guardian already exists");
        isGuardian[guardian] = true;
        emit GuardianAdded(guardian);
    }

    /// @notice Removes a redemption guardian
    /// @param guardian Address of the guardian to remove.
    /// @dev Requirements:
    ///      - The caller must be the owner,
    ///      - The guardian must exist.
    function removeGuardian(address guardian) external onlyOwner {
        require(isGuardian[guardian], "Guardian does not exist");
        delete isGuardian[guardian];
        emit GuardianRemoved(guardian);
    }
}
