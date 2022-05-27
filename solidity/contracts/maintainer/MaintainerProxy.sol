// SPDX-License-Identifier: MIT

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

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@keep-network/random-beacon/contracts/Reimbursable.sol";
import "@keep-network/random-beacon/contracts/ReimbursementPool.sol";

import "../bridge/BitcoinTx.sol";
import "../bridge/Bridge.sol";

/// @title Maintainer Proxy
/// @notice Maintainers are the willing off-chain clients approved by the governance.
///         Maintainers proxy calls to the Bridge contract via 'MaintainerProxy'
///         and are refunded for the spent gas from the Reimbursement Pool.
///         Only the authorized maintainers can call 'MaintainerProxy' functions.
contract MaintainerProxy is Ownable, Reimbursable {
    Bridge public bridge;

    /// @notice Authorized maintainers that can interact with the set of functions
    ///         for maintainers only. Authorization can be granted and removed by
    ///         the governance.
    /// @dev    'Key' is the address of the maintainer. 'Value' represents an index+1
    ///         in the 'maintainers' array. 1 was added so the maintainer index can
    ///         never be 0 which is a reserved index for a non-existent maintainer
    ///         in ths map.
    mapping(address => uint256) public isAuthorized;

    /// @notice This list of maintainers keeps the order of which maintainer should
    ///         be submitting a next transaction. It does not enforce the order
    ///         but only tracks who should be next in line.
    address[] public maintainers;

    /// @notice Gas that is meant to balance the submission of deposit sweep proof
    ///         overall cost. Can be updated by the governance based on the current
    ///         market conditions.
    uint256 internal _submitDepositSweepProofGasOffset;

    /// @notice Gas that is meant to balance the submission of redemption proof
    ///         overall cost. Can be updated by the governance based on the current
    ///         market conditions.
    uint256 internal _submitRedemptionProofGasOffset;

    /// @notice Gas that is meant to balance the submission of moving funds commitment
    ///         overall cost. Can be updated by the governance based on the current
    ///         market conditions.
    uint256 internal _submitMovingFundsCommitmentGasOffset;

    /// @notice Gas that is meant to balance the reset of moving funds timeout
    ///         overall cost. Can be updated by the governance based on the current
    ///         market conditions.
    uint256 internal _resetMovingFundsTimeoutGasOffset;

    /// @notice Gas that is meant to balance the submission of moving funds proof
    ///         overall cost. Can be updated by the governance based on the current
    ///         market conditions.
    uint256 internal _submitMovingFundsProofGasOffset;

    /// @notice Gas that is meant to balance the notification of moving funds below
    ///         dust overall cost. Can be updated by the governance based on the
    ///         current market conditions.
    uint256 internal _notifyMovingFundsBelowDustGasOffset;

    /// @notice Gas that is meant to balance the submission of moved funds sweep
    ///         proof overall cost. Can be updated by the governance based on the
    ///         current market conditions.
    uint256 internal _submitMovedFundsSweepProofGasOffset;

    /// @notice Gas that is meant to balance the request of a new wallet overall
    ///         cost. Can be updated by the governance based on the current
    ///         market conditions.
    uint256 internal _requestNewWalletGasOffset;

    /// @notice Gas that is meant to balance the notification of closeable wallet
    ///         overall cost. Can be updated by the governance based on the current
    ///         market conditions.
    uint256 internal _notifyWalletCloseableGasOffset;

    /// @notice Gas that is meant to balance the notification of wallet closing
    ///         period elapsed overall cost. Can be updated by the governance
    ///         based on the current market conditions.
    uint256 internal _notifyWalletClosingPeriodElapsedGasOffset;

    /// @notice Gas that is meant to balance the defeat fraud challenge
    ///         overall cost. Can be updated by the governance based on the current
    ///         market conditions.
    uint256 internal _defeatFraudChallengeGasOffset;

    /// @notice Gas that is meant to balance the defeat fraud challenge with heartbeat
    ///         overall cost. Can be updated by the governance based on the current
    ///         market conditions.
    uint256 internal _defeatFraudChallengeWithHeartbeatGasOffset;

    event MaintainerAuthorized(address indexed maintainer);

    event MaintainerUnauthorized(address indexed maintainer);

    event BridgeUpdated(address newBridge);

    event GasOffsetParametersUpdated(
        uint256 submitDepositSweepProofGasOffset,
        uint256 submitRedemptionProofGasOffset,
        uint256 submitMovingFundsCommitmentGasOffset,
        uint256 resetMovingFundsTimeoutGasOffset,
        uint256 submitMovingFundsProofGasOffset,
        uint256 notifyMovingFundsBelowDustGasOffset,
        uint256 submitMovedFundsSweepProofGasOffset,
        uint256 requestNewWalletGasOffset,
        uint256 notifyWalletCloseableGasOffset,
        uint256 notifyWalletClosingPeriodElapsedGasOffset,
        uint256 defeatFraudChallengeGasOffset,
        uint256 defeatFraudChallengeWithHeartbeatGasOffset
    );

    modifier onlyMaintainer() {
        require(isAuthorized[msg.sender] != 0, "Caller is not authorized");
        _;
    }

    modifier onlyReimbursableAdmin() override {
        require(owner() == msg.sender, "Caller is not the owner");
        _;
    }

    constructor(Bridge _bridge, ReimbursementPool _reimbursementPool) {
        bridge = _bridge;
        reimbursementPool = _reimbursementPool;
        _submitDepositSweepProofGasOffset = 26750;
        _submitRedemptionProofGasOffset = 9750;
        _submitMovingFundsCommitmentGasOffset = 8000;
        _resetMovingFundsTimeoutGasOffset = 1000;
        _submitMovingFundsProofGasOffset = 15000;
        _notifyMovingFundsBelowDustGasOffset = 3500;
        _submitMovedFundsSweepProofGasOffset = 22000;
        _requestNewWalletGasOffset = 3000;
        _notifyWalletCloseableGasOffset = 4000;
        _notifyWalletClosingPeriodElapsedGasOffset = 3000;
        _defeatFraudChallengeGasOffset = 10000;
        _defeatFraudChallengeWithHeartbeatGasOffset = 5000;
    }

    /// @notice Wraps `Bridge.submitDepositSweepProof` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.submitDepositSweepProof` function documentation.
    function submitDepositSweepProof(
        BitcoinTx.Info calldata sweepTx,
        BitcoinTx.Proof calldata sweepProof,
        BitcoinTx.UTXO calldata mainUtxo,
        address vault
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.submitDepositSweepProof(sweepTx, sweepProof, mainUtxo, vault);

        reimbursementPool.refund(
            (gasStart - gasleft()) + _submitDepositSweepProofGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.submitRedemptionProof` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.submitRedemptionProof` function documentation.
    function submitRedemptionProof(
        BitcoinTx.Info calldata redemptionTx,
        BitcoinTx.Proof calldata redemptionProof,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes20 walletPubKeyHash
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.submitRedemptionProof(
            redemptionTx,
            redemptionProof,
            mainUtxo,
            walletPubKeyHash
        );

        reimbursementPool.refund(
            (gasStart - gasleft()) + _submitRedemptionProofGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.submitMovingFundsCommitment` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.submitMovingFundsCommitment` function documentation.
    function submitMovingFundsCommitment(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata walletMainUtxo,
        uint32[] calldata walletMembersIDs,
        uint256 walletMemberIndex,
        bytes20[] calldata targetWallets
    ) external {
        uint256 gasStart = gasleft();

        bridge.submitMovingFundsCommitment(
            walletPubKeyHash,
            walletMainUtxo,
            walletMembersIDs,
            walletMemberIndex,
            targetWallets
        );

        reimbursementPool.refund(
            (gasStart - gasleft()) + _submitMovingFundsCommitmentGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.resetMovingFundsTimeout` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.resetMovingFundsTimeout` function documentation.
    function resetMovingFundsTimeout(bytes20 walletPubKeyHash) external {
        uint256 gasStart = gasleft();

        bridge.resetMovingFundsTimeout(walletPubKeyHash);

        reimbursementPool.refund(
            (gasStart - gasleft()) + _resetMovingFundsTimeoutGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.submitMovingFundsProof` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.submitMovingFundsProof` function documentation.
    function submitMovingFundsProof(
        BitcoinTx.Info calldata movingFundsTx,
        BitcoinTx.Proof calldata movingFundsProof,
        BitcoinTx.UTXO calldata mainUtxo,
        bytes20 walletPubKeyHash
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.submitMovingFundsProof(
            movingFundsTx,
            movingFundsProof,
            mainUtxo,
            walletPubKeyHash
        );

        reimbursementPool.refund(
            (gasStart - gasleft()) + _submitMovingFundsProofGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.notifyMovingFundsBelowDust` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.notifyMovingFundsBelowDust` function documentation.
    function notifyMovingFundsBelowDust(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata mainUtxo
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.notifyMovingFundsBelowDust(walletPubKeyHash, mainUtxo);

        reimbursementPool.refund(
            (gasStart - gasleft()) + _notifyMovingFundsBelowDustGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.submitMovedFundsSweepProof` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.submitMovedFundsSweepProof` function documentation.
    function submitMovedFundsSweepProof(
        BitcoinTx.Info calldata sweepTx,
        BitcoinTx.Proof calldata sweepProof,
        BitcoinTx.UTXO calldata mainUtxo
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.submitMovedFundsSweepProof(sweepTx, sweepProof, mainUtxo);

        reimbursementPool.refund(
            (gasStart - gasleft()) + _submitMovedFundsSweepProofGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.requestNewWallet` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.requestNewWallet` function documentation.
    function requestNewWallet(BitcoinTx.UTXO calldata activeWalletMainUtxo)
        external
        onlyMaintainer
    {
        uint256 gasStart = gasleft();

        bridge.requestNewWallet(activeWalletMainUtxo);

        reimbursementPool.refund(
            (gasStart - gasleft()) + _requestNewWalletGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.notifyWalletCloseable` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.notifyWalletCloseable` function documentation.
    function notifyWalletCloseable(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata walletMainUtxo
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.notifyWalletCloseable(walletPubKeyHash, walletMainUtxo);

        reimbursementPool.refund(
            (gasStart - gasleft()) + _notifyWalletCloseableGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.notifyWalletClosingPeriodElapsed` call and reimburses
    ///         the caller's transaction cost.
    /// @dev See `Bridge.notifyWalletClosingPeriodElapsed` function documentation.
    function notifyWalletClosingPeriodElapsed(bytes20 walletPubKeyHash)
        external
        onlyMaintainer
    {
        uint256 gasStart = gasleft();

        bridge.notifyWalletClosingPeriodElapsed(walletPubKeyHash);

        reimbursementPool.refund(
            (gasStart - gasleft()) + _notifyWalletClosingPeriodElapsedGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.defeatFraudChallenge` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `Bridge.defeatFraudChallenge` function documentation.
    function defeatFraudChallenge(
        bytes calldata walletPublicKey,
        bytes calldata preimage,
        bool witness
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.defeatFraudChallenge(walletPublicKey, preimage, witness);

        reimbursementPool.refund(
            (gasStart - gasleft()) + _defeatFraudChallengeGasOffset,
            msg.sender
        );
    }

    /// @notice Wraps `Bridge.defeatFraudChallengeWithHeartbeat` call and
    ///         reimburses the caller's transaction cost.
    /// @dev See `Bridge.defeatFraudChallengeWithHeartbeat` function documentation.
    function defeatFraudChallengeWithHeartbeat(
        bytes calldata walletPublicKey,
        bytes calldata heartbeatMessage
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.defeatFraudChallengeWithHeartbeat(
            walletPublicKey,
            heartbeatMessage
        );

        reimbursementPool.refund(
            (gasStart - gasleft()) +
                _defeatFraudChallengeWithHeartbeatGasOffset,
            msg.sender
        );
    }

    /// @notice Authorize a maintainer that can interact with this reimbursement pool.
    ///         Can be authorized by the owner only.
    /// @param maintainer Maintainer to authorize.
    function authorize(address maintainer) external onlyOwner {
        maintainers.push(maintainer);
        isAuthorized[maintainer] = maintainers.length;

        emit MaintainerAuthorized(maintainer);
    }

    /// @notice Unauthorize a maintainer that was previously authorized to interact
    ///         with the Maintainer Proxy contract. Can be unauthorized by the
    ///         owner only.
    /// @dev    The last maintainer is swapped with the one to be unauthorized.
    ///         The unauthorized maintainer is then removed from the list. An index
    ///         of the last maintainer is changed with the removed maintainer.
    ///         Ex.
    ///         'maintainers' list: [0x1, 0x2, 0x3, 0x4, 0x5]
    ///         'isAuthorized' map: [0x1 -> 1, 0x2 -> 2, 0x3 -> 3, 0x4 -> 4, 0x5 -> 5]
    ///         unauthorize: 0x3
    ///         new 'maintainers' list: [0x1, 0x2, 0x5, 0x4]
    ///         new 'isAuthorized' map: [0x1 -> 1, 0x2 -> 2, 0x4 -> 4, 0x5 -> 3]
    /// @param maintainerToUnauthorize Maintainer to unauthorize.
    function unauthorize(address maintainerToUnauthorize) external onlyOwner {
        uint256 maintainerIdToUnauthorize = isAuthorized[
            maintainerToUnauthorize
        ];

        require(maintainerIdToUnauthorize != 0, "No contract to unauthorize");

        address lastMaintainerAddress = maintainers[maintainers.length - 1];

        maintainers[maintainerIdToUnauthorize - 1] = maintainers[
            maintainers.length - 1
        ];
        maintainers.pop();

        isAuthorized[lastMaintainerAddress] = maintainerIdToUnauthorize;

        delete isAuthorized[maintainerToUnauthorize];

        emit MaintainerUnauthorized(maintainerToUnauthorize);
    }

    /// @notice Allows the Governance to upgrade the Bridge address.
    /// @dev The function does not implement any governance delay and does not
    ///      check the status of the Bridge. The Governance implementation needs
    ///      to ensure all requirements for the upgrade are satisfied before
    ///      executing this function.
    function updateBridge(Bridge _bridge) external onlyOwner {
        bridge = _bridge;

        emit BridgeUpdated(address(_bridge));
    }

    /// @notice Updates the values of gas offset parameters.
    /// @dev Can be called only by the contract owner. The caller is responsible
    ///      for validating parameters.
    /// @param submitDepositSweepProofGasOffset New submit deposit sweep proof gas offset
    /// @param submitRedemptionProofGasOffset New submit redemption proof gas offset
    /// @param submitMovingFundsCommitmentGasOffset New submit moving funds commitment gas offset
    /// @param submitMovingFundsProofGasOffset New submit moving funds proof gas offset
    /// @param notifyMovingFundsBelowDustGasOffset New notify moving funds below dust gas offset
    /// @param submitMovedFundsSweepProofGasOffset New submit moved funds sweep proof gas offset
    /// @param requestNewWalletGasOffset New request new wallet gas offset
    /// @param notifyWalletCloseableGasOffset New notify closeable wallet gas offset
    /// @param notifyWalletClosingPeriodElapsedGasOffset New notify wallet closing period elapsed gas offset
    /// @param defeatFraudChallengeGasOffset New defeat fraud challenge gas offset
    /// @param defeatFraudChallengeWithHeartbeatGasOffset New defeat fraud challenge with heartbeat gas offset
    function updateGasOffsetParameters(
        uint256 submitDepositSweepProofGasOffset,
        uint256 submitRedemptionProofGasOffset,
        uint256 submitMovingFundsCommitmentGasOffset,
        uint256 resetMovingFundsTimeoutGasOffset,
        uint256 submitMovingFundsProofGasOffset,
        uint256 notifyMovingFundsBelowDustGasOffset,
        uint256 submitMovedFundsSweepProofGasOffset,
        uint256 requestNewWalletGasOffset,
        uint256 notifyWalletCloseableGasOffset,
        uint256 notifyWalletClosingPeriodElapsedGasOffset,
        uint256 defeatFraudChallengeGasOffset,
        uint256 defeatFraudChallengeWithHeartbeatGasOffset
    ) external onlyOwner {
        _submitDepositSweepProofGasOffset = submitDepositSweepProofGasOffset;
        _submitRedemptionProofGasOffset = submitRedemptionProofGasOffset;
        _submitMovingFundsCommitmentGasOffset = submitMovingFundsCommitmentGasOffset;
        _resetMovingFundsTimeoutGasOffset = resetMovingFundsTimeoutGasOffset;
        _submitMovingFundsProofGasOffset = submitMovingFundsProofGasOffset;
        _notifyMovingFundsBelowDustGasOffset = notifyMovingFundsBelowDustGasOffset;
        _submitMovedFundsSweepProofGasOffset = submitMovedFundsSweepProofGasOffset;
        _requestNewWalletGasOffset = requestNewWalletGasOffset;
        _notifyWalletCloseableGasOffset = notifyWalletCloseableGasOffset;
        _notifyWalletClosingPeriodElapsedGasOffset = notifyWalletClosingPeriodElapsedGasOffset;
        _defeatFraudChallengeGasOffset = defeatFraudChallengeGasOffset;
        _defeatFraudChallengeWithHeartbeatGasOffset = defeatFraudChallengeWithHeartbeatGasOffset;

        emit GasOffsetParametersUpdated(
            submitDepositSweepProofGasOffset,
            submitRedemptionProofGasOffset,
            submitMovingFundsCommitmentGasOffset,
            resetMovingFundsTimeoutGasOffset,
            submitMovingFundsProofGasOffset,
            notifyMovingFundsBelowDustGasOffset,
            submitMovedFundsSweepProofGasOffset,
            requestNewWalletGasOffset,
            notifyWalletCloseableGasOffset,
            notifyWalletClosingPeriodElapsedGasOffset,
            defeatFraudChallengeGasOffset,
            defeatFraudChallengeWithHeartbeatGasOffset
        );
    }
}
