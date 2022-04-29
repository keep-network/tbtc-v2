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

// TODO: Documentation.
library MergingFunds {
    using BridgeState for BridgeState.Storage;

    // TODO: Documentation.
    struct MergingFundsRequest {
        uint32 requestedAt;
        uint32 mergedAt;
    }

    event MergingFundsRequested(bytes32 txHash, uint32 outputIndex);

    // TODO: Documentation.
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
