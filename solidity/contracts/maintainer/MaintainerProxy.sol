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
    uint256 public submitSweepProofGasOffset = 21000;
    // TODO: make it upgradable
    uint256 public submitRedemptionProofGasOffset = 9750;

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
    function submitSweepProof(
        BitcoinTx.Info calldata sweepTx,
        BitcoinTx.Proof calldata sweepProof,
        BitcoinTx.UTXO calldata mainUtxo
    ) external onlyMaintainer {
        uint256 gasStart = gasleft();

        bridge.submitSweepProof(sweepTx, sweepProof, mainUtxo);

        reimbursementPool.refund(
            (gasStart - gasleft()) + submitSweepProofGasOffset,
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
