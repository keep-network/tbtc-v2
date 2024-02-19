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
    struct VetoProposal {
        // Address of the redeemer that requested the redemption.
        address redeemer;
        // Amount that the redeemer can claim after the freeze period.
        // Value is 0 if the veto is not finalized or the amount was
        // already claimed.
        uint64 claimableAmount;
        // Timestamp when the veto was finalized. Value is 0 if the veto is
        // not finalized.
        uint32 finalizedAt;
        // Number of objections raised against the redemption request.
        uint8 objectionsCount;
    }

    /// @notice Set of redemption guardians.
    mapping(address => bool) public isGuardian;
    /// @notice Set of banned redeemer addresses. Banned redeemers cannot
    ///         request redemptions. A redeemer is banned if one of their
    ///         redemption requests is vetoed due to an enough number of
    ///         guardian objections.
    mapping(address => bool) public isBanned;
    /// @notice Set of veto proposals indexed by the redemption key built as
    ///         `keccak256(keccak256(redeemerOutputScript) | walletPubKeyHash)`.
    ///         The `walletPubKeyHash` is the 20-byte wallet's public key hash
    ///         (computed using Bitcoin HASH160 over the compressed ECDSA
    ///         public key) and `redeemerOutputScript` is the Bitcoin script
    ///         (P2PKH, P2WPKH, P2SH or P2WSH) that is involved in the
    ///         redemption request.
    mapping(uint256 => VetoProposal) public vetoProposals;
    /// @notice Set of individual guardian objections indexed by the objection
    ///         key built as `keccak256(redemptionKey | guardian)`.
    ///         The `redemptionKey` is the redemption key built in the same way
    ///         as in the `vetoProposals` mapping. The `guardian` is the
    ///         address of the  guardian who raised the objection.
    mapping(uint256 => bool) public objections;
    /// @notice The Bridge contract.
    Bridge public bridge;
    /// @notice UNIX timestamp the redemption watchtower (and veto mechanism)
    ///         was enabled at.
    uint32 public watchtowerEnabledAt;
    /// @notice Duration of the watchtower lifetime in seconds. Once this
    ///         period elapses (since the `watchtowerEnabledAt` timestamp),
    ///         the watchtower can be permanently disabled by anyone.
    uint32 public watchtowerLifetime;
    /// @notice UNIX timestamp the redemption watchtower (and veto mechanism)
    ///         was permanently disabled at.
    uint32 public watchtowerDisabledAt;
    /// @notice Address of the manager responsible for parameters management.
    address public manager;
    /// @notice Divisor used to compute the redemption veto penalty fee deducted
    ///         upon veto finalization. This fee diminishes the amount that the
    ///         redeemer can claim after the freeze period and is computed as follows:
    ///         `penaltyFee = requestedAmount / redemptionVetoPenaltyFeeDivisor`
    ///         For example, if the penalty fee needs to be 2% of each vetoed
    ///         redemption request, the `redemptionVetoPenaltyFeeDivisor` should
    ///         be set to `50` because `1/50 = 0.02 = 2%`.
    uint64 public vetoPenaltyFeeDivisor;
    /// @notice Time of the redemption veto freeze period. It is the time after
    ///         which the redeemer can claim the amount of the vetoed redemption
    ///         request. The freeze period is counted from the moment when the
    ///         veto request was finalized (i.e. moment of the last guardian
    ///         objection that caused finalization). Value in seconds.
    uint32 public vetoFreezePeriod;
    /// @notice Default delay applied to each redemption request. It is the time
    ///         during which redemption guardians can raise the first objection.
    ///         Wallets are not allowed to finalize the redemption request before
    ///         the delay is over. The delay is counted from the moment when the
    ///         redemption request was created. Value in seconds.
    uint32 public defaultDelay;
    /// @notice Delay applied to redemption requests a single guardian raised an
    ///         objection to. It is the time during which the remaining guardians
    ///         can raise their objections. Wallets are not allowed to finalize the
    ///         redemption request before the delay is over. The delay is counted
    ///         from the moment when the redemption request was created.
    ///         Value in seconds.
    uint32 public levelOneDelay;
    /// @notice Delay applied to redemption requests two guardians raised an
    ///         objection to. It is the time during which the last guardian
    ///         can raise its objection. Wallets are not allowed to finalize the
    ///         redemption request before the delay is over. The delay is counted
    ///         from the moment when the redemption request was created.
    ///         Value in seconds.
    uint32 public levelTwoDelay;

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

        watchtowerLifetime = 18 * 30 days; // 18 months
        vetoPenaltyFeeDivisor = 1; // 100% as initial penalty fee
        vetoFreezePeriod = 30 days; // 1 month
        defaultDelay = 2 hours;
        levelOneDelay = 8 hours;
        levelTwoDelay = 24 hours;
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
