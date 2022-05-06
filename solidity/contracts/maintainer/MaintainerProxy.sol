// SPDX-License-Identifier: MIT
//
// ▓▓▌ ▓▓ ▐▓▓ ▓▓▓▓▓▓▓▓▓▓▌▐▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄
// ▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▌▐▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
//   ▓▓▓▓▓▓    ▓▓▓▓▓▓▓▀    ▐▓▓▓▓▓▓    ▐▓▓▓▓▓   ▓▓▓▓▓▓     ▓▓▓▓▓   ▐▓▓▓▓▓▌   ▐▓▓▓▓▓▓
//   ▓▓▓▓▓▓▄▄▓▓▓▓▓▓▓▀      ▐▓▓▓▓▓▓▄▄▄▄         ▓▓▓▓▓▓▄▄▄▄         ▐▓▓▓▓▓▌   ▐▓▓▓▓▓▓
//   ▓▓▓▓▓▓▓▓▓▓▓▓▓▀        ▐▓▓▓▓▓▓▓▓▓▓         ▓▓▓▓▓▓▓▓▓▓         ▐▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
//   ▓▓▓▓▓▓▀▀▓▓▓▓▓▓▄       ▐▓▓▓▓▓▓▀▀▀▀         ▓▓▓▓▓▓▀▀▀▀         ▐▓▓▓▓▓▓▓▓▓▓▓▓▓▓▀
//   ▓▓▓▓▓▓   ▀▓▓▓▓▓▓▄     ▐▓▓▓▓▓▓     ▓▓▓▓▓   ▓▓▓▓▓▓     ▓▓▓▓▓   ▐▓▓▓▓▓▌
// ▓▓▓▓▓▓▓▓▓▓ █▓▓▓▓▓▓▓▓▓ ▐▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓
// ▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓ ▐▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓
//
//                           Trust math, not hardware.

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@keep-network/random-beacon/contracts/Reimbursable.sol";
import "@keep-network/random-beacon/contracts/ReimbursementPool.sol";

import "../bridge/BitcoinTx.sol";
import "../bridge/Bridge.sol";

// TODO: add description
contract MaintainerProxy is Ownable, Reimbursable {
    Bridge public bridge;

    /// @notice Authorized maintainer that can interact with the maintainer proxy
    ///         contract. Authorization can be granted and removed by the governance.
    mapping(address => bool) public isAuthorized;

    // TODO: make it upgradable
    uint256 public requestNewWalletGasOffset = 3000;
    // TODO: make it upgradable
    uint256 public submitDepositSweepProofGasOffset = 26500;
    // TODO: make it upgradable
    uint256 public submitRedemptionProofGasOffset = 9750;
    // TODO: make it upgradable
    uint256 public notifyCloseableWalletGasOffset = 4000;
    // TODO: make it upgradable
    uint256 public defeatFraudChallengeGasOffset = 10000;
    // TODO: make it upgradable
    uint256 public submitMovingFundsProofGasOffset = 12500;

    event MaintainerAuthorized(address indexed maintainer);

    event MaintainerUnauthorized(address indexed maintainer);

    event BridgeUpdated(address newBridge);

    modifier onlyMaintainer() {
        require(isAuthorized[msg.sender], "Caller is not authorized");
        _;
    }

    constructor(Bridge _bridge, ReimbursementPool _reimbursementPool) {
        bridge = _bridge;
        reimbursementPool = _reimbursementPool;
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
            (gasStart - gasleft()) + requestNewWalletGasOffset,
            msg.sender
        );
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
        BitcoinTx.UTXO calldata mainUtxo
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.submitDepositSweepProof(sweepTx, sweepProof, mainUtxo);

        reimbursementPool.refund(
            (gasStart - gasleft()) + submitDepositSweepProofGasOffset,
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
            (gasStart - gasleft()) + submitRedemptionProofGasOffset,
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
            (gasStart - gasleft()) + notifyCloseableWalletGasOffset,
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
            (gasStart - gasleft()) + defeatFraudChallengeGasOffset,
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
    ) external {
        uint256 gasStart = gasleft();

        bridge.submitMovingFundsProof(
            movingFundsTx,
            movingFundsProof,
            mainUtxo,
            walletPubKeyHash
        );

        reimbursementPool.refund(
            (gasStart - gasleft()) + submitMovingFundsProofGasOffset,
            msg.sender
        );
    }

    // TODO: add submitMovingFundsCommitment()

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
}
