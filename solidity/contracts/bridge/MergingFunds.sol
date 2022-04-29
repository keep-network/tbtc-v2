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

import "./BridgeState.sol";

/// @title Merging received funds with wallet's main UTXO.
/// @notice The library handles the logic for merging received funds with
///         the wallet's main UTXO.
/// @dev Apart from deposits, a wallet can receive funds either through an
///      external donation or as an effect of a moving funds process. In order
///      to pull those funds under wallet's management, the recipient wallet
///      is notified about a merging funds request, broadcast a BTC transaction
///      that merges the received UTXO with the wallet's main UTXO, and
///      submits the proof of that merge to the Bridge. Those steps cause
///      an update of the wallet's BTC balance in the system.
library MergingFunds {
    using BridgeState for BridgeState.Storage;

    /// @notice Represents a moving funds request.
    struct MergingFundsRequest {
        // UNIX timestamp the moving funds was requested at.
        uint32 requestedAt;
        // // UNIX timestamp the request was merged at.
        uint32 mergedAt;
    }

    event MergingFundsRequested(bytes32 txHash, uint32 outputIndex);

    /// @notice Requests merging funds action from a given wallet.
    /// @param txHash 32-byte hash of the BTC transaction that locked the funds
    ///        on the recipient wallet's public key hash
    /// @param outputIndex Index of the transaction output that holds the funds
    ///        that need to be merged by the recipient wallet.
    /// @dev Requirements:
    ///      - Request for given `txHash` and `outputIndex` pair cannot exist
    function requestMergingFunds(
        BridgeState.Storage storage self,
        bytes32 txHash,
        uint32 outputIndex
    ) external {
        MergingFundsRequest storage request = self.mergingFundsRequests[
            uint256(keccak256(abi.encodePacked(txHash, outputIndex)))
        ];

        require(
            request.requestedAt == 0,
            "Merging funds request already exists"
        );
        /* solhint-disable-next-line not-rely-on-time */
        request.requestedAt = uint32(block.timestamp);

        emit MergingFundsRequested(txHash, outputIndex);
    }

    // TODO: Implement `submitMergingFundsProof` that will check the SPV
    //       proof of merge transaction and close the merging funds request.
    //       That function should be callable for Live and MovingFunds wallets.
}
