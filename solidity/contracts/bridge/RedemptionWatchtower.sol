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
import "./Redemption.sol";

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
    /// @notice The Bank contract.
    Bank public bank;
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

    event ObjectionRaised(
        uint256 indexed redemptionKey,
        address indexed guardian
    );

    event VetoPeriodCheckOmitted(uint256 indexed redemptionKey);

    event VetoFinalized(uint256 indexed redemptionKey);

    event WatchtowerParametersUpdated(
        uint32 watchtowerLifetime,
        uint64 vetoPenaltyFeeDivisor,
        uint32 vetoFreezePeriod,
        uint32 defaultDelay,
        uint32 levelOneDelay,
        uint32 levelTwoDelay
    );

    modifier onlyManager() {
        require(msg.sender == manager, "Caller is not watchtower manager");
        _;
    }

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "Caller is not guardian");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(Bridge _bridge) external initializer {
        __Ownable_init();

        bridge = _bridge;
        (bank, , , ) = _bridge.contractReferences();

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

    /// @notice Raises an objection to a redemption request identified by the
    ///         key built as `keccak256(keccak256(redeemerOutputScript) | walletPubKeyHash)`.
    ///         Each redemption has a default delay period during which
    ///         the wallet is not allowed to process it and the guardians
    ///         can raise objections to. Each objection extends the delay
    ///         period by a certain amount of time. The third objection
    ///         vetoes the redemption request. This causes the redemption
    ///         request to be rejected and the redeemer to be penalized.
    ///         Specific consequences of a veto are as follows:
    ///         - The redemption amount is frozen for a certain period of time,
    ///         - Once the freeze period expires, the redeemer can claim the
    ///           frozen amount minus a penalty fee,
    ///         - The penalty fee is burned,
    ///         - The redeemer is banned from making future redemption requests.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet.
    /// @param redeemerOutputScript The redeemer's length-prefixed output
    ///        script (P2PKH, P2WPKH, P2SH or P2WSH).
    /// @dev Requirements:
    ///      - The caller must be a redemption guardian,
    ///      - The redemption request must exist (i.e. must be pending),
    ///      - The redemption request must not have been vetoed already,
    ///      - The guardian must not have already objected to the redemption request,
    ///      - The redemption request must be within the optimistic redemption
    ///        delay period. The only exception is when the redemption request
    ///        was created before the optimistic redemption mechanism
    ///        initialization timestamp. In this case, the redemption request
    ///        can be objected to without any time restrictions.
    function raiseObjection(
        bytes20 walletPubKeyHash,
        bytes calldata redeemerOutputScript
    ) external onlyGuardian {
        uint256 redemptionKey = Redemption.getRedemptionKey(
            walletPubKeyHash,
            redeemerOutputScript
        );

        Redemption.RedemptionRequest memory redemption = bridge
            .pendingRedemptions(redemptionKey);

        require(
            redemption.requestedAt != 0,
            "Redemption request does not exist"
        );

        VetoProposal storage veto = vetoProposals[redemptionKey];

        uint8 requiredObjectionsCount = 3;

        require(
            veto.objectionsCount < requiredObjectionsCount,
            "Redemption request already vetoed"
        );

        uint256 objectionKey = uint256(
            keccak256(abi.encodePacked(redemptionKey, msg.sender))
        );
        require(!objections[objectionKey], "Guardian already objected");

        // Check if the given redemption request can be objected to:
        // - Objections against a redemption request created AFTER the
        //   `watchtowerEnabledAt` timestamp can be raised only within
        //   a certain time frame defined by the redemption delay.
        // - Objections against a redemption request created BEFORE the
        //   `watchtowerEnabledAt` timestamp can be raised without
        //   any time restrictions.
        if (redemption.requestedAt >= watchtowerEnabledAt) {
            require(
                /* solhint-disable-next-line not-rely-on-time */
                block.timestamp <
                    redemption.requestedAt +
                        _redemptionDelay(veto.objectionsCount),
                "Redemption veto delay period expired"
            );
        } else {
            emit VetoPeriodCheckOmitted(redemptionKey);
        }

        objections[objectionKey] = true;
        // Set the redeemer address in the veto request early to slightly
        // reduce gas costs for the last guardian that must pay for the
        // veto finalization.
        veto.redeemer = redemption.redeemer;
        veto.objectionsCount++;

        emit ObjectionRaised(redemptionKey, msg.sender);

        // If there are enough objections, finalize the veto.
        if (veto.objectionsCount == requiredObjectionsCount) {
            // Calculate the veto penalty fee that will be deducted from the
            // final amount that the redeemer can claim after the freeze period.
            uint64 penaltyFee = vetoPenaltyFeeDivisor > 0
                ? redemption.requestedAmount / vetoPenaltyFeeDivisor
                : 0;

            // Set finalization fields in the veto request.
            veto.claimableAmount = redemption.requestedAmount - penaltyFee;
            /* solhint-disable-next-line not-rely-on-time */
            veto.finalizedAt = uint32(block.timestamp);
            // Mark the redeemer as banned to prevent future redemption
            // requests from that address.
            isBanned[redemption.redeemer] = true;

            emit VetoFinalized(redemptionKey);

            // Notify the Bridge about the veto. As result of this call,
            // this contract should receive the requested redemption amount
            // (as Bank's balance) from the Bridge.
            bridge.notifyRedemptionVeto(walletPubKeyHash, redeemerOutputScript);
            // Burn the penalty fee but leave the claimable amount. The
            // claimable amount will be returned to the redeemer after the
            // freeze period.
            bank.decreaseBalance(penaltyFee);
        }
    }

    /// @notice Returns the redemption delay for a given number of objections.
    /// @param objectionsCount Number of objections.
    /// @return delay Redemption delay.
    function _redemptionDelay(uint8 objectionsCount)
        internal
        view
        returns (uint32 delay)
    {
        if (objectionsCount == 0) {
            delay = defaultDelay;
        } else if (objectionsCount == 1) {
            delay = levelOneDelay;
        } else if (objectionsCount == 2) {
            delay = levelTwoDelay;
        } else {
            revert("No delay for given objections count");
        }
    }

    /// @notice Updates the watchtower parameters.
    /// @param _watchtowerLifetime Duration of the watchtower lifetime in seconds.
    /// @param _vetoPenaltyFeeDivisor Divisor used to compute the redemption veto
    ///        penalty fee deducted upon veto finalization.
    /// @param _vetoFreezePeriod Time of the redemption veto freeze period.
    /// @param _defaultDelay Default delay applied to each redemption request.
    /// @param _levelOneDelay Delay applied to redemption requests a single guardian
    ///        raised an objection to.
    /// @param _levelTwoDelay Delay applied to redemption requests two guardians
    ///        raised an objection to.
    /// @dev Requirements:
    ///      - The caller must be the watchtower manager,
    ///      - The new watchtower lifetime must not be lesser than the current one,
    ///      - The new redemption veto penalty fee divisor must be in range [0%, 5%],
    ///      - The new redemption level-two delay must not be lesser than level-one delay,
    ///      - The new redemption level-one delay must not be lesser than default delay.
    function updateWatchtowerParameters(
        uint32 _watchtowerLifetime,
        uint64 _vetoPenaltyFeeDivisor,
        uint32 _vetoFreezePeriod,
        uint32 _defaultDelay,
        uint32 _levelOneDelay,
        uint32 _levelTwoDelay
    ) external onlyManager {
        require(
            _watchtowerLifetime >= watchtowerLifetime,
            "New lifetime must not be lesser than current one"
        );

        // Enforce the 5% hard cap.
        require(
            _vetoPenaltyFeeDivisor >= 20 || _vetoPenaltyFeeDivisor == 0,
            "Redemption veto penalty fee must be in range [0%, 5%]"
        );

        // Enforce proper relationship between the delay levels. Use
        // `>=` to allow for setting all delays to zero, if needed.
        require(
            _levelTwoDelay >= _levelOneDelay,
            "Redemption level-two delay must not be lesser than level-one delay"
        );
        require(
            _levelOneDelay >= _defaultDelay,
            "Redemption level-one delay must not be lesser than default delay"
        );

        watchtowerLifetime = _watchtowerLifetime;
        vetoPenaltyFeeDivisor = _vetoPenaltyFeeDivisor;
        vetoFreezePeriod = _vetoFreezePeriod;
        defaultDelay = _defaultDelay;
        levelOneDelay = _levelOneDelay;
        levelTwoDelay = _levelTwoDelay;

        emit WatchtowerParametersUpdated(
            _watchtowerLifetime,
            _vetoPenaltyFeeDivisor,
            _vetoFreezePeriod,
            _defaultDelay,
            _levelOneDelay,
            _levelTwoDelay
        );
    }
}
