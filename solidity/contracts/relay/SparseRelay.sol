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

import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";
import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {ValidateSPV} from "@keep-network/bitcoin-spv-sol/contracts/ValidateSPV.sol";

struct Chain {
    // The height of the current longest chain.
    uint32 height;
    // The timestamp of the start of the current epoch, according to the
    // current longest chain. If the retarget is subject to a reorg, the
    // winning chain will overwrite the epoch start. If the original chain
    // overtakes the overwriting chain, it will have to supply all blocks since
    // the point of divergence between the two chains, and the epoch start will
    // once again be overwritten.
    uint32 latestEpochStart;
    // The timestamp of the start of the previous epoch.
    uint32 previousEpochStart;
    // Mapping from height to digest for all recorded blocks.
    // This acts like a ring buffer containing one epoch's worth of blocks.
    // We take the height modulo 2016 and store every sixth block from that,
    // giving the buffer an effective capacity of 336 blocks.
    // The first block of the buffer is always the starting block of the epoch.
    mapping(uint256 => bytes32) blocks;
}

interface ISparseRelay {}

library SparseRelayUtils {
    using BytesLib for bytes;

    function position(uint256 height) internal pure returns (uint256) {
        return height % 2016;
    }

    /// @dev Not checking for underflow, not designed for ancient blocks.
    function previous(uint256 height) internal pure returns (uint256) {
        unchecked {
            return (height - 6) % 2016;
        }
    }

    function addBlock(
        Chain storage self,
        uint256 height,
        bytes32 digest
    ) internal {
        self.blocks[height % 2016] = digest;
    }

    function getDigest(Chain storage self, uint256 height)
        internal
        view
        returns (bytes32)
    {
        return self.blocks[height % 2016];
    }

    function getDigest(bytes memory headers, uint256 at)
        internal
        view
        returns (bytes32)
    {
        return BTCUtils.hash256Slice(headers, at, 80);
    }

    /// @notice Extract the timestamp of the header at the given position.
    /// @param headers Byte array containing the header of interest.
    /// @param at The start of the header in the array.
    /// @return The timestamp of the header.
    /// @dev Assumes that the specified position contains a valid header.
    /// Performs no validation whatsoever.
    function extractTimestampAt(bytes memory headers, uint256 at)
        internal
        pure
        returns (uint32)
    {
        return BTCUtils.reverseUint32(uint32(headers.slice4(68 + at)));
    }
}

contract SparseRelay is Ownable, ISparseRelay {
    using BytesLib for bytes;
    using BTCUtils for bytes;
    using ValidateSPV for bytes;
    using SparseRelayUtils for bytes;
    using SparseRelayUtils for Chain;

    struct Data {
        uint256 newHeight;
        uint256 currentTarget;
        bytes32 previousHeaderDigest;
        uint32 retargetTimestamp;
        uint32 previousRetargetTimestamp;
    }

    Chain internal chain;

    /// @notice Establish a starting point for the relay by providing the
    /// first block of the relay chain, and the first block of the epoch.
    /// @param epochStartHeader The first block header of the genesis epoch.
    /// @param genesisHeader The header of the starting block of the relay.
    /// @param genesisHeight The height of the starting block of the relay.
    /// @dev The genesisHeader and the epochStartHeader can be the same, or
    /// they can be different.
    /// In any case, the height of the genesisHeader must be divisible by 6.
    function genesis(
        bytes calldata epochStartHeader,
        bytes calldata genesisHeader,
        uint24 genesisHeight
    ) external onlyOwner {
        require(chain.height == 0, "Relay already initialised");

        require(genesisHeight % 6 == 0, "Genesis block height invalid");

        require(
            genesisHeader.length == 80 && epochStartHeader.length == 80,
            "Invalid header length"
        );

        chain.height = genesisHeight;
        chain.addBlock(genesisHeight, genesisHeader.getDigest(0));
        chain.latestEpochStart = epochStartHeader.extractTimestamp();
    }

    /// @notice Add headers to the relay chain.
    /// @param ancestorHeight The height of the ancestor block (see below).
    /// @param headers The headers to be added, with the first header being the
    /// most recent ancestor of both the new chain and the current chain to be
    /// recorded in the relay. If there is no reorg, this would be the tip of
    /// the chain. If there is a reorg, this would be the most recent
    /// non-orphan block recorded in the relay that is present in both chains.
    /// The number of new headers must be divisible by six; thus the total
    /// number of headers will be of the form 6k+1.
    function addHeaders(uint256 ancestorHeight, bytes calldata headers)
        external
    {
        require(ancestorHeight % 6 == 0, "Invalid ancestor height");
        require(chain.height > 0, "Relay is not initialised");
        require(headers.length % 80 == 0, "Invalid header array");
        uint256 headerCount = headers.length / 80;
        require(
            headerCount % 6 == 1 && headerCount > 1,
            "Invalid number of headers"
        );

        Data memory data = Data(0, 0, bytes32(0), 0, 0);

        data.previousHeaderDigest = headers.getDigest(0);

        require(
            data.previousHeaderDigest == chain.getDigest(ancestorHeight),
            "Ancestor not recorded in relay"
        );

        data.currentTarget = headers.extractTarget();

        // Validate and record the chain.
        for (uint256 i = 1; i < headerCount; i++) {
            (
                bytes32 currentDigest,
                uint256 currentHeaderTarget
            ) = validateHeader(headers, i * 80, data.previousHeaderDigest);
            data.previousHeaderDigest = currentDigest;

            require(
                currentHeaderTarget & data.currentTarget == currentHeaderTarget,
                "Invalid target"
            );

            uint256 currentHeight = ancestorHeight + i;

            // This is the last block of the epoch, calculate new target.
            if (currentHeight % 2016 == 2015) {
                uint32 epochStartTime;
                // The ancestor is in the same epoch as the chain is currently,
                // so we use the current epoch's starting time.
                if (ancestorHeight / 2016 == chain.height / 2016) {
                    epochStartTime = chain.latestEpochStart;
                }
                // We are attempting a reorg over a retarget,
                // so the correct target is the previous one.
                else {
                    epochStartTime = chain.previousEpochStart;
                }

                uint256 epochEndTimestamp = headers.extractTimestampAt(i * 80);
                // Prevent difficulty manipulation by requiring that the epoch
                // ends in the past. Without this check, an attacker could
                // produce a chain with 1/4 the difficulty of the legitimate
                // chain, and mine it faster. It would then be accepted by the
                // relay, because we don't check accumulated difficulty, only
                // length and adherence to the difficulty calculation rules.
                // With the check, the attacker would only be able to submit
                // such a chain when the legitimate chain has produced enough
                // blocks that winning the reorg is effectively impossible.
                require(
                    /* solhint-disable-next-line not-rely-on-time */
                    epochEndTimestamp < block.timestamp,
                    "Epoch may not end in the future"
                );
                data.currentTarget = BTCUtils.retargetAlgorithm(
                    data.currentTarget,
                    epochStartTime,
                    epochEndTimestamp
                );
                data.previousRetargetTimestamp = epochStartTime;
            }

            // This is the first block of the epoch, record it.
            if (currentHeight % 2016 == 0) {
                chain.latestEpochStart = headers.extractTimestampAt(i * 80);
                chain.previousEpochStart = data.previousRetargetTimestamp;
            }

            // Record every sixth block in the relay.
            if (i % 6 == 0) {
                bytes32 currentStoredDigest = chain.getDigest(currentHeight);
                // If this block is already stored in the relay, our ancestor
                // block was incorrect. If it is not already stored, we are
                // either extending the chain from the current tip or
                // attempting a reorg.
                require(
                    currentStoredDigest != currentDigest,
                    "Invalid ancestor block"
                );
                chain.addBlock(currentHeight, currentDigest);

                data.newHeight = currentHeight;
            }
        }

        // Check for reorgs.
        if (ancestorHeight != chain.height) {
            // HACK: We only compare the height of valid competing chains.
            // The timestamp check gives some sanity constraints, but
            // ultimately the relay assumes that the gas costs of processing
            // competing chains become infeasible by the time someone could
            // produce a chain longer than the legitimate one.
            //
            // If the attempted retarget is not strictly longer than the
            // previous longest chain, we revert to reverses all state changes.
            require(
                chain.height < data.newHeight,
                "Insufficient length in reorg"
            );
        }
        chain.height = uint32(data.newHeight);
    }

    /// @notice Check that the given chain of headers belongs to the longest
    /// chain and has at least 6 confirmations.
    /// @param firstHeaderHeight The blockheight of the first given header.
    /// @param headers A byte array of 6 consecutive bitcoin headers.
    /// @return True if the headers are valid, throw an error otherwise.
    /// @dev We check the relay for a matching record. Because we record every
    /// sixth block, a chain of six headers should always have one match.
    /// If a match is not found, we cannot prove these headers. They may be too
    /// new and the relay hasn't caught up yet, or they may be invalid.
    /// If a non-orphan match is found, two outcomes are possible:
    /// If the matching block is older than the current chain tip, we know it
    /// has sufficient confirmations and can short-circuit out.
    /// If the matching block is the current tip, we need to validate the rest
    /// of the headers to reach the required 6 confirmations. In this case we
    /// make sure that the remaining blocks were mined with sufficient work.
    function validate(uint256 firstHeaderHeight, bytes calldata headers)
        external
        view
        returns (bool)
    {
        require(headers.length == 480, "Invalid header length");

        bytes32 previousHeaderDigest = bytes32(0);
        uint256 target;
        uint256 expectedTarget = 0;

        for (uint256 i = 0; i < 6; i++) {
            (previousHeaderDigest, target) = validateHeader(
                headers,
                i * 80,
                previousHeaderDigest
            );

            uint256 currentHeight = firstHeaderHeight + i;
            if (currentHeight % 6 == 0) {
                //  We should have a record of this block if it is part of the
                // longest chain.
                require(
                    chain.getDigest(currentHeight) == previousHeaderDigest,
                    "Headers not part of the longest chain"
                );

                // We found the block, and we have sufficient confirmations
                // on top of it, so we don't need to validate the given
                // chain any further.
                if (currentHeight < chain.height) {
                    return true;
                }
                // We found the block, but it is the current chain tip and
                // thus did not have the required confirmations. Continue
                // validating the given chain.
                else {
                    // Record the target here, to make sure that the
                    // remaining headers are mined with sufficient work.
                    expectedTarget = target;
                    continue;
                }
            }

            // We have anchored this chain of headers, but need to finish
            // validating them.
            if (expectedTarget != 0) {
                // The previous target was set by the block recorded in the
                // relay. All remaining targets must match; if the chain
                // contains a retarget it has to be in a recorded block.
                require(target == expectedTarget, "Invalid target");
            }
        }

        // If foundHeight is nonzero, at least one block of the chain is
        // recorded in the relay.
        require(expectedTarget != 0, "Headers not recorded in relay");
        // If we did not throw an error, at least the first header of the given
        // chain is a part of the current longest chain, and there are
        // sufficient confirmations with the correct work.
        return true;
    }

    function getHeight() external view returns (uint256) {
        return uint256(chain.height);
    }

    /// @notice Check that the specified header forms a correct chain with the
    /// digest of the previous header (if provided), and has sufficient work.
    /// @param headers The byte array containing the header of interest.
    /// @param start The start of the header in the array.
    /// @param prevDigest The digest of the previous header
    /// (optional; providing zeros for the digest skips the check).
    /// @return digest The digest of the current header.
    /// @return target The PoW target of the header.
    /// @dev Throws an exception if the header's chain or PoW are invalid.
    /// Performs no other validation.
    function validateHeader(
        bytes memory headers,
        uint256 start,
        bytes32 prevDigest
    ) internal view returns (bytes32 digest, uint256 target) {
        // If previous block digest has been provided, require that it matches
        if (prevDigest != bytes32(0)) {
            require(
                headers.validateHeaderPrevHash(start, prevDigest),
                "Invalid chain"
            );
        }

        // Require that the header has sufficient work for its stated target
        target = headers.extractTargetAt(start);
        digest = headers.hash256Slice(start, 80);
        require(ValidateSPV.validateHeaderWork(digest, target), "Invalid work");

        return (digest, target);
    }
}
