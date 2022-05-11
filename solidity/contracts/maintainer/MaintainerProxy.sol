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

    /// @notice Authorized maintainer that can interact with the maintainer proxy
    ///         contract. Authorization can be granted and removed by the governance.
    mapping(address => bool) public isAuthorized;

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
    uint256 internal _notifyCloseableWalletGasOffset;

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
        uint256 requestNewWalletGasOffset,
        uint256 submitDepositSweepProofGasOffset,
        uint256 submitRedemptionProofGasOffset,
        uint256 notifyCloseableWalletGasOffset,
        uint256 defeatFraudChallengeGasOffset,
        uint256 submitMovingFundsProofGasOffset,
        uint256 submitMovingFundsCommitmentGasOffset
    );

    modifier onlyMaintainer() {
        require(isAuthorized[msg.sender], "Caller is not authorized");
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
        _submitMovingFundsProofGasOffset = 15000;
        _notifyMovingFundsBelowDustGasOffset = 3500;
        _submitMovedFundsSweepProofGasOffset = 22000;
        _requestNewWalletGasOffset = 3000;
        _notifyCloseableWalletGasOffset = 4000;
        _notifyWalletClosingPeriodElapsedGasOffset = 3000;
        _defeatFraudChallengeGasOffset = 10000;
        _defeatFraudChallengeWithHeartbeatGasOffset = 5000;
    }

    /// @notice Wraps submit sweep proof call and reimburses a caller's
    ///         transaction cost.
    /// @param sweepTx Bitcoin sweep transaction data
    /// @param sweepProof Bitcoin sweep proof data
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain. If no main UTXO exists for the given wallet,
    ///        this parameter is ignored
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

    /// @notice Wraps submit redemption proof call and reimburses a caller's
    ///         transaction cost.
    /// @param redemptionTx Bitcoin redemption transaction data
    /// @param redemptionProof Bitcoin redemption proof data
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    ///        HASH160 over the compressed ECDSA public key) of the wallet which
    ///        performed the redemption transaction
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

    /// @notice Submits the moving funds target wallets commitment.
    ///         Once all requirements are met, that function registers the
    ///         target wallets commitment and opens the way for moving funds
    ///         proof submission.
    /// @param walletPubKeyHash 20-byte public key hash of the source wallet
    /// @param walletMainUtxo Data of the source wallet's main UTXO, as
    ///        currently known on the Ethereum chain
    /// @param walletMembersIDs Identifiers of the source wallet signing group
    ///        members
    /// @param walletMemberIndex Position of the caller in the source wallet
    ///        signing group members list
    /// @param targetWallets List of 20-byte public key hashes of the target
    ///        wallets that the source wallet commits to move the funds to
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

    /// @notice Used by the wallet to prove the BTC moving funds transaction
    ///         and to make the necessary state changes. Moving funds is only
    ///         accepted if it satisfies SPV proof.
    ///
    ///         The function validates the moving funds transaction structure
    ///         by checking if it actually spends the main UTXO of the declared
    ///         wallet and locks the value on the pre-committed target wallets
    ///         using a reasonable transaction fee. If all preconditions are
    ///         met, this functions closes the source wallet.
    ///
    ///         It is possible to prove the given moving funds transaction only
    ///         one time.
    /// @param movingFundsTx Bitcoin moving funds transaction data
    /// @param movingFundsProof Bitcoin moving funds proof data
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known on
    ///        the Ethereum chain
    /// @param walletPubKeyHash 20-byte public key hash (computed using Bitcoin
    ///        HASH160 over the compressed ECDSA public key) of the wallet
    ///        which performed the moving funds transaction
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

    /// @notice Notifies about a moving funds wallet whose BTC balance is
    ///         below the moving funds dust threshold. Ends the moving funds
    ///         process and begins wallet closing immediately.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @param mainUtxo Data of the wallet's main UTXO, as currently known
    ///        on the Ethereum chain.
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

    /// @notice Used by the wallet to prove the BTC moved funds sweep
    ///         transaction and to make the necessary state changes. Moved
    ///         funds sweep is only accepted if it satisfies SPV proof.
    ///
    ///         The function validates the sweep transaction structure by
    ///         checking if it actually spends the moved funds UTXO and the
    ///         sweeping wallet's main UTXO (optionally), and if it locks the
    ///         value on the sweeping wallet's 20-byte public key hash using a
    ///         reasonable transaction fee. If all preconditions are
    ///         met, this function updates the sweeping wallet main UTXO, thus
    ///         their BTC balance.
    ///
    ///         It is possible to prove the given sweep transaction only
    ///         one time.
    /// @param sweepTx Bitcoin sweep funds transaction data
    /// @param sweepProof Bitcoin sweep funds proof data
    /// @param mainUtxo Data of the sweeping wallet's main UTXO, as currently
    ///        known on the Ethereum chain
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

    /// @notice Wraps request new wallet call and reimburses a caller's
    ///         transaction cost.
    /// @param activeWalletMainUtxo Data of the active wallet's main UTXO, as
    ///        currently known on the Ethereum chain.
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

    /// @notice Notifies that the wallet is either old enough or has too few
    ///         satoshis left and qualifies to be closed.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @param walletMainUtxo Data of the wallet's main UTXO, as currently
    ///        known on the Ethereum chain.
    function notifyCloseableWallet(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata walletMainUtxo
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.notifyCloseableWallet(walletPubKeyHash, walletMainUtxo);

        reimbursementPool.refund(
            (gasStart - gasleft()) + _notifyCloseableWalletGasOffset,
            msg.sender
        );
    }

    /// @notice Notifies about the end of the closing period for the given wallet.
    ///         Closes the wallet ultimately and notifies the ECDSA registry
    ///         about this fact.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
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

    /// @notice Allows to defeat a pending fraud challenge against a wallet if
    ///         the transaction that spends the UTXO follows the protocol rules.
    ///         In order to defeat the challenge the same `walletPublicKey` and
    ///         signature (represented by `r`, `s` and `v`) must be provided as
    ///         were used to calculate the sighash during input signing.
    ///         The fraud challenge defeat attempt will only succeed if the
    ///         inputs in the preimage are considered honestly spent by the
    ///         wallet. Therefore the transaction spending the UTXO must be
    ///         proven in the Bridge before a challenge defeat is called.
    ///         If successfully defeated, the fraud challenge is marked as
    ///         resolved and the amount of ether deposited by the challenger is
    ///         sent to the treasury.
    /// @param walletPublicKey The public key of the wallet in the uncompressed
    ///        and unprefixed format (64 bytes)
    /// @param preimage The preimage which produces sighash used to generate the
    ///        ECDSA signature that is the subject of the fraud claim. It is a
    ///        serialized subset of the transaction. The exact subset used as
    ///        the preimage depends on the transaction input the signature is
    ///        produced for. See BIP-143 for reference
    /// @param witness Flag indicating whether the preimage was produced for a
    ///        witness input. True for witness, false for non-witness input
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

    /// @notice Allows to defeat a pending fraud challenge against a wallet by
    ///         proving the sighash and signature were produced for an off-chain
    ///         wallet heartbeat message following a strict format.
    ///         In order to defeat the challenge the same `walletPublicKey` and
    ///         signature (represented by `r`, `s` and `v`) must be provided as
    ///         were used to calculate the sighash during heartbeat message
    ///         signing. The fraud challenge defeat attempt will only succeed if
    ///         the signed message follows a strict format required for
    ///         heartbeat messages. If successfully defeated, the fraud
    ///         challenge is marked as resolved and the amount of ether
    ///         deposited by the challenger is sent to the treasury.
    /// @param walletPublicKey The public key of the wallet in the uncompressed
    ///        and unprefixed format (64 bytes)
    /// @param heartbeatMessage Off-chain heartbeat message meeting the heartbeat
    ///        message format requirements which produces sighash used to
    ///        generate the ECDSA signature that is the subject of the fraud
    ///        claim
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

    /// @notice Authorize a maintainer that can interact with this reimbursment pool.
    ///         Can be authorized by the owner only.
    /// @param maintainer Maintainer authorized.
    function authorize(address maintainer) external onlyOwner {
        isAuthorized[maintainer] = true;

        emit MaintainerAuthorized(maintainer);
    }

    /// @notice Unauthorize a maintainer that was previously authorized to interact
    ///         with the Maintainer Proxy contract. Can be unauthorized by the
    ///         owner only.
    /// @param maintainer Maintainer unauthorized.
    function unauthorize(address maintainer) external onlyOwner {
        delete isAuthorized[maintainer];

        emit MaintainerUnauthorized(maintainer);
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

    // TODO add new params and order them

    /// @notice Updates the values of gas offset parameters.
    /// @dev Can be called only by the contract owner. The caller is responsible
    ///      for validating parameters.
    /// @param requestNewWalletGasOffset New request wallet gas offset
    /// @param submitDepositSweepProofGasOffset New request wallet gas offset
    /// @param submitRedemptionProofGasOffset New submit redemption proof gas offset
    /// @param notifyCloseableWalletGasOffset New notify closeable wallet gas offset
    /// @param defeatFraudChallengeGasOffset New defeat fraud challenge gas offset
    /// @param submitMovingFundsProofGasOffset New submit moving funds proof gas offset
    /// @param submitMovingFundsCommitmentGasOffset New submit moving funds commitment gas offset
    function updateGasOffsetParameters(
        uint256 requestNewWalletGasOffset,
        uint256 submitDepositSweepProofGasOffset,
        uint256 submitRedemptionProofGasOffset,
        uint256 notifyCloseableWalletGasOffset,
        uint256 defeatFraudChallengeGasOffset,
        uint256 submitMovingFundsProofGasOffset,
        uint256 submitMovingFundsCommitmentGasOffset
    ) external onlyOwner {
        _requestNewWalletGasOffset = requestNewWalletGasOffset;
        _submitDepositSweepProofGasOffset = submitDepositSweepProofGasOffset;
        _submitRedemptionProofGasOffset = submitRedemptionProofGasOffset;
        _notifyCloseableWalletGasOffset = notifyCloseableWalletGasOffset;
        _defeatFraudChallengeGasOffset = defeatFraudChallengeGasOffset;
        _submitMovingFundsProofGasOffset = submitMovingFundsProofGasOffset;
        _submitMovingFundsCommitmentGasOffset = submitMovingFundsCommitmentGasOffset;

        emit GasOffsetParametersUpdated(
            _requestNewWalletGasOffset,
            _submitDepositSweepProofGasOffset,
            _submitRedemptionProofGasOffset,
            _notifyCloseableWalletGasOffset,
            _defeatFraudChallengeGasOffset,
            _submitMovingFundsProofGasOffset,
            _submitMovingFundsCommitmentGasOffset
        );
    }
}
