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

struct Block {
    // up to 16 million; sufficient for a couple of centuries
    uint24 height;
    // if true, the block is not part of the current longest chain
    bool isOrphan;
    // The hash256 digest of the previous block in the sparse chain,
    // excluding bits that are zero by definition.
    // To be precise, this refers to the block 6 blocks earlier.
    bytes28 prevDigest;
}

struct Chain {
    // The height of the current longest chain.
    uint24 height;
    // The digest of the most recent block in the longest chain.
    bytes28 tip;
    // Mapping from digest to block data for all recorded blocks.
    mapping(bytes28 => Block) blocks;
    // Mapping from blockheight to timestamp of epoch start.
    //
    // Each epoch has only one start, which is the one belonging to the longest
    // chain. If the retarget is subject to a reorg, the winning chain will
    // overwrite the previous epoch start. If the original chain overtakes the
    // overwriting chain, it will have to supply all blocks since the point of
    // divergence between the two chains, and the epoch start will once again
    // be overwritten.
    mapping(uint24 => uint32) epochStart;
}

interface ISparseRelay {}

library RelayUtils {
    using BytesLib for bytes;

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
    using RelayUtils for bytes;

    struct Data {
        bytes28 newTip;
        uint24 newHeight;
        uint256 currentTarget;
        bytes32 previousStoredDigest;
        bytes32 previousHeaderDigest;
        bytes32 ancestorDigest;
        Block ancestorBlock;
        bool retargetPresent;
        uint24 retargetHeight;
        uint32 retargetTimestamp;
    }

    Chain internal chain;

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

        Block memory genesisBlock = Block(genesisHeight, false, bytes28(0));

        chain.height = genesisHeight;
        bytes28 genesisDigest = bytes28(genesisHeader.getDigest(0));
        chain.tip = genesisDigest;
        chain.blocks[genesisDigest] = genesisBlock;

        uint24 epochStartHeight = genesisHeight - (genesisHeight % 2016);
        uint32 epochStartTime = epochStartHeader.extractTimestamp();

        chain.epochStart[epochStartHeight] = epochStartTime;
    }

    function addHeaders(bytes calldata headers) external {
        require(headers.length % 80 == 0, "Invalid header array");
        uint256 headerCount = headers.length / 80;
        require(headerCount % 6 == 1, "Invalid number of headers");

        Data memory data;

        data.ancestorDigest = headers.getDigest(0);
        data.ancestorBlock = chain.blocks[bytes28(data.ancestorDigest)];

        require(
            data.ancestorBlock.height != 0,
            "Ancestor not recorded in relay"
        );
        require(!data.ancestorBlock.isOrphan, "Ancestor must not be orphan");

        data.currentTarget = headers.extractTarget();

        data.previousStoredDigest = data.ancestorDigest;
        data.previousHeaderDigest = data.ancestorDigest;

        data.retargetPresent = false;

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

            uint256 currentHeight = data.ancestorBlock.height + i;

            // This is the last block of the epoch, calculate new target.
            if (currentHeight % 2016 == 2015) {
                uint24 epochStartHeight = uint24(currentHeight - 2015);
                uint32 epochStartTime = chain.epochStart[epochStartHeight];
                uint256 epochEndTimestamp = headers.extractTimestampAt(i * 80);
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
            }

            // This is the first block of the epoch, record it.
            if (currentHeight % 2016 == 0) {
                data.retargetPresent = true;
                data.retargetHeight = uint24(currentHeight);
                data.retargetTimestamp = headers.extractTimestampAt(i * 80);
            }

            // Record every sixth block in the relay.
            if (i % 6 == 0) {
                Block storage currentBlock = chain.blocks[
                    bytes28(currentDigest)
                ];
                // If the current block is already recorded in the relay,
                // it must be flagged as an orphan.
                // Otherwise the ancestor block (which we already checked is
                // a part of the longest chain) would not be the most recent
                // ancestor shared with the current chain and the new blocks.
                require(
                    currentBlock.height == 0 || currentBlock.isOrphan,
                    "Invalid ancestor block"
                );
                currentBlock.height = uint24(currentHeight);
                currentBlock.isOrphan = false;
                currentBlock.prevDigest = bytes28(data.previousStoredDigest);

                data.newTip = bytes28(currentDigest);
                data.newHeight = uint24(currentHeight);

                data.previousStoredDigest = currentDigest;
            }
        }

        // Check for reorgs.
        //
        // All is good, record new tip and new height.
        if (bytes28(data.ancestorDigest) == chain.tip) {
            chain.tip = data.newTip;
            chain.height = data.newHeight;

            // Record the retarget if we have one.
            if (data.retargetPresent) {
                chain.epochStart[data.retargetHeight] = data.retargetTimestamp;
            }
        }
        // This sucks, we have a reorg.
        else {
            bytes28 orphanTip;
            bytes28 winningTip;
            uint24 winningHeight;

            // HACK: We only compare the height of valid competing chains.
            // A really dedicated attacker could mine blocks with a different
            // retarget, resulting in roughly 4x lower difficulty.
            // They can then keep outproducing the legitimate chain if they
            // have at least 25% of bitcoin hashpower.
            // I think we can get away with this because it would be really
            // weird for anyone to actually do that.
            if (chain.height < data.newHeight) {
                orphanTip = chain.tip;
                winningTip = data.newTip;
                winningHeight = data.newHeight;

                // The new chain is winning, so record its retarget if present.
                if (data.retargetPresent) {
                    chain.epochStart[data.retargetHeight] = data
                        .retargetTimestamp;
                }
            } else {
                orphanTip = data.newTip;
                winningTip = chain.tip;
                winningHeight = chain.height;

                // The new chain is an orphan, so we don't care about its
                // retarget even if it had one. If it overtakes the original
                // chain, we will process these blocks again as part of
                // a longer chain which will take the other path.
            }

            // Mark all blocks of the orphan chain.
            // We know that the ancestor is the most recent ancestor of both
            // competing chains, so we mark all blocks of the shorter chain as
            // orphans.
            bytes28 orphanDigest = orphanTip;
            while (orphanDigest != bytes28(data.ancestorDigest)) {
                Block storage orphanBlock = chain.blocks[orphanDigest];
                orphanBlock.isOrphan = true;
                orphanDigest = orphanBlock.prevDigest;
            }

            // Whichever chain won, record it in the relay.
            chain.tip = winningTip;
            chain.height = winningHeight;
        }
    }

    function validate(bytes calldata headers, uint256 confirmations)
        external
        view
        returns (bool)
    {
        require(headers.length == 480, "Invalid header length");

        bytes32 previousHeaderDigest = bytes32(0);
        uint256 target;
        Block storage foundBlock;
        bool found = false;

        for (uint256 i = 0; i < 6; i++) {
            (previousHeaderDigest, target) = validateHeader(
                headers,
                i * 80,
                previousHeaderDigest
            );
            foundBlock = chain.blocks[bytes28(previousHeaderDigest)];
            if (foundBlock.height > 0) {
                require(
                    !foundBlock.isOrphan,
                    "Headers not part of longest chain"
                );
                require(
                    (foundBlock.height + confirmations) <= chain.height,
                    "Insufficient confirmations"
                );
                found = true;
                continue;
            }
        }

        require(found, "Headers not recorded in relay");
        return found;
    }

    function getHeight() external view returns (uint256) {
        return uint256(chain.height);
    }

    function getTip() external view returns (bytes32) {
        return bytes32(chain.tip);
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
