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


struct Epoch {
    uint256 target;
    uint256 timestamp;
}

library RelayUtils {
    using BytesLib for bytes;

    /// @notice Extract the timestamp of the header at the given position.
    /// @param headers Byte array containing the header of interest.
    /// @param at The start of the header in the array.
    /// @return The timestamp of the header.
    /// @dev Assumes that the specified position contains a valid header.
    /// Performs no validation whatsoever.
    function extractTimestampAt(
        bytes memory headers,
        uint256 at
    ) internal pure returns (uint32) {
        return BTCUtils.reverseUint32(uint32(headers.slice4(68 + at)));
    }
}

interface ILightRelay {
    event Genesis(uint256 blockHeight);
    event Retarget(uint256 oldDifficulty, uint256 newDifficulty);

    function retarget(bytes memory headers) external;

    function validateChain(
        bytes memory headers
    ) external view returns (bool valid);

    function getBlockDifficulty(
        uint256 blockNumber
    ) external view returns (uint256);

    function getEpochDifficulty(
        uint256 epochNumber
    ) external view returns (uint256);

    function getRelayRange() external view returns (
        uint256 relayGenesis,
        uint256 currentEpochEnd
    );
}

contract Relay is Ownable, ILightRelay {
    using BytesLib for bytes;
    using BTCUtils for bytes;
    using ValidateSPV for bytes;
    using RelayUtils for bytes;

    bool public ready;
    // Number of blocks required for a proof
    // Governable
    uint256 public proofLength;
    // The number of the first epoch recorded by the relay.
    // This should equal the height of the block starting the genesis epoch,
    // divided by 2016, but this is not enforced as the relay has no
    // information about block numbers.
    uint256 public genesisEpoch;
    // The number of the latest epoch whose difficulty is proven to the relay.
    // If the genesis epoch's number is set correctly, and retargets along the
    // way have been legitimate, this equals the height of the block starting
    // the most recent epoch, divided by 2016.
    uint256 public currentEpoch;

    // Each epoch from genesis to the current one, keyed by their numbers.
    mapping(uint256 => Epoch) epochs;

    /// @notice Establish a starting point for the relay by providing the
    /// target, timestamp and blockheight of the first block of the relay
    /// genesis epoch.
    /// @param genesisHeader The first block header of the genesis epoch.
    /// @param genesisHeight The block number of the first block of the epoch.
    /// @param genesisProofLength The number of blocks required to accept a
    /// proof.
    function genesis(
        bytes calldata genesisHeader,
        uint256 genesisHeight,
        uint256 genesisProofLength
    ) external onlyOwner {
        require(
            !ready,
            "Genesis already performed"
        );

        require(
            genesisHeader.length == 80,
            "Invalid genesis header length"
        );

        require(
            genesisHeight % 2016 == 0,
            "Invalid height of relay genesis block"
        );

        require(
            genesisProofLength < 2016,
            "Proof length excessive"
        );

        genesisEpoch = genesisHeight / 2016;
        uint256 genesisTarget = genesisHeader.extractTarget();
        uint256 genesisTimestamp = genesisHeader.extractTimestamp();
        epochs[genesisEpoch] = Epoch(
            genesisTarget,
            genesisTimestamp
        );
        proofLength = genesisProofLength;
        ready = true;

        emit Genesis(genesisHeight);
    }

    /// @notice Set the number of blocks required to accept a header chain.
    /// @param newLength The required number of blocks.
    function setProofLength(uint256 newLength) external relayActive onlyOwner {
        require(
            newLength < 2016,
            "Proof length excessive"
        );
        proofLength = newLength;
    }

    /// @notice Add a new epoch to the relay by providing a proof
    /// of the difficulty before and after the retarget.
    /// @param headers A chain of headers including the last X blocks before
    /// the retarget, followed by the first X blocks after the retarget,
    /// where X equals the current proof length.
    /// @dev Checks that the first X blocks are valid in the most recent epoch,
    /// that the difficulty of the new epoch is calculated correctly according
    /// to the block timestamps, and that the next X blocks would be valid in
    /// the new epoch.
    /// We have no information of block heights, so we cannot enforce that
    /// retargets only happen every 2016 blocks; instead, we assume that this
    /// is the case if a valid proof of work is provided.
    /// It is possible to cheat the relay by providing X blocks from earlier in
    /// the most recent epoch, and then mining X new blocks after them.
    /// However, each of these malicious blocks would have to be mined to a
    /// higher difficulty than the legitimate ones.
    /// Alternatively, if the retarget has not been performed yet, one could
    /// first mine X blocks in the old difficulty with timestamps set far in
    /// the future, and then another X blocks at a greatly reduced difficulty.
    /// In either case, cheating the realy requires more work than mining X
    /// legitimate blocks.
    /// Only the most recent epoch is vulnerable to these attacks; once a
    /// retarget has been proven to the relay, the epoch is immutable even if a
    /// contradictory proof were to be presented later.
    function retarget(bytes memory headers) external relayActive {
        require(
            // Require proofLength headers on both sides of the retarget
            headers.length == (proofLength * 2 * 80),
            "Invalid header length"
        );

        Epoch storage latest = epochs[currentEpoch];

        uint256 oldTarget = latest.target;

        bytes32 previousHeaderDigest;
        // Validate old chain
        for (uint256 i = 0; i < proofLength; i++) {
            (bytes32 currentDigest, uint256 currentHeaderTarget) = validateHeader(
                headers,
                i * 80,
                previousHeaderDigest
            );

            require(
                currentHeaderTarget == oldTarget,
                "Invalid target"
            );

            previousHeaderDigest = currentDigest;
        }

        // get timestamp of retarget block
        uint256 epochEndTimestamp = headers.extractTimestampAt(
            (proofLength - 1) * 80
        );

        uint256 expectedTarget = BTCUtils.retargetAlgorithm(
            oldTarget,
            latest.timestamp,
            epochEndTimestamp
        );

        uint256 epochStartTimestamp = headers.extractTimestampAt(
            proofLength * 80
        );

        // validate new chain
        for (uint256 i = proofLength; i < proofLength * 2; i++) {
            (bytes32 currentDigest, uint256 currentHeaderTarget) = validateHeader(
                headers,
                i * 80,
                previousHeaderDigest
            );

            require(
                currentHeaderTarget == expectedTarget,
                "Invalid target"
            );

            previousHeaderDigest = currentDigest;
        }

        currentEpoch = currentEpoch + 1;

        epochs[currentEpoch] = Epoch(expectedTarget, epochStartTimestamp);

        emit Retarget(oldTarget, expectedTarget);
    }

    /// @notice Check whether a given chain of headers should be accepted as
    /// valid within the rules of the relay.
    /// @param headers A chain of `proofLength` bitcoin headers.
    /// @return valid True if the headers are valid according to the relay.
    /// If the validation fails, this function throws an exception.
    /// @dev A chain of headers is accepted as valid if:
    /// - It has the correct length required for a proof.
    /// - Headers in the chain are sequential and refer to previous digests.
    /// - Each header is mined with the correct amount of work.
    /// - The difficulty in each header matches an epoch of the relay,
    ///   as determined by the headers' timestamps. The headers must be between
    ///   the genesis epoch and the latest proven epoch (inclusive).
    /// If the chain contains a retarget, it is accepted if the retarget has
    /// already been proven to the relay.
    /// If the chain contains blocks of an epoch that has not been proven to
    /// the relay (after a retarget within the header chain, or when the entire
    /// chain falls within an epoch that has not been proven yet), it will be
    /// rejected.
    /// One exception to this is when two subsequent epochs have exactly the
    /// same difficulty; headers from the latter epoch will be accepted if the
    /// previous epoch has been proven to the relay.
    /// This is because it is not possible to distinguish such headers from
    /// headers of the previous epoch.
    ///
    /// If the difficulty increases significantly between relay genesis and the
    /// present, creating fraudulent proofs for earlier epochs becomes easier.
    /// Users of the relay should check the timestamps of valid headers and
    /// only accept appropriately recent ones.
    function validateChain(
        bytes memory headers
    ) external view relayActive returns (bool valid) {
        require(
            headers.length == proofLength * 80,
            "Invalid header length"
        );

        bytes32 previousHeaderDigest;

        uint256 firstHeaderTimestamp = headers.extractTimestamp();

        uint256 relevantEpoch = currentEpoch;
        uint256 _genesisEpoch = genesisEpoch;

        // timestamp of the epoch the header chain starts in
        uint256 startingEpochTimestamp = epochs[currentEpoch].timestamp;
        // timestamp of the next epoch after that
        uint256 nextEpochTimestamp;

        // Find the correct epoch for the given chain
        // Fastest with recent epochs, but able to handle anything after genesis
        while (firstHeaderTimestamp < startingEpochTimestamp) {
            relevantEpoch -= 1;
            nextEpochTimestamp = startingEpochTimestamp;
            startingEpochTimestamp = epochs[relevantEpoch].timestamp;
            require(
                relevantEpoch >= _genesisEpoch,
                "Cannot validate chains before relay genesis"
            );
        }

        uint256 relevantTarget = epochs[relevantEpoch].target;

        for (uint256 i = 0; i < proofLength; i++) {
            (bytes32 currentDigest, uint256 currentHeaderTarget) = validateHeader(
                headers,
                i * 80,
                previousHeaderDigest
            );

            uint256 currentHeaderTimestamp = headers.extractTimestampAt(i * 80);

            // we have a retarget in the chain
            if (currentHeaderTimestamp >= nextEpochTimestamp) {
                require(
                    currentHeaderTimestamp == nextEpochTimestamp,
                    "Invalid timestamp in retarget"
                );

                relevantTarget = epochs[relevantEpoch + 1].target;
            }

            require(
                currentHeaderTarget == relevantTarget,
                "Invalid target in header chain"
            );

            previousHeaderDigest = currentDigest;
        }

        return true;
    }

    /// @notice Get the difficulty of the specified block.
    /// @param blockNumber The number of the block. Must fall within the relay
    /// range (at or after the relay genesis, and at or before the end of the
    /// most recent epoch proven to the relay).
    /// @return The difficulty of the epoch.
    function getBlockDifficulty(
        uint256 blockNumber
    ) external view relayActive returns (uint256) {
        return getEpochDifficulty(blockNumber / 2016);
    }

    /// @notice Get the difficulty of the specified epoch.
    /// @param epochNumber The number of the epoch (the height of the first
    /// block of the epoch, divided by 2016). Must fall within the relay range.
    /// @return The difficulty of the epoch.
    function getEpochDifficulty(
        uint256 epochNumber
    ) public view relayActive returns (uint256) {
        require(
            epochNumber >= genesisEpoch,
            "Epoch is before relay genesis"
        );
        require(
            epochNumber <= currentEpoch,
            "Epoch is not proven to the relay yet"
        );
        return BTCUtils.calculateDifficulty(
            epochs[epochNumber].target
        );
    }

    /// @notice Get the range of blocks the relay can accept proofs for.
    /// @dev Assumes that the genesis has been set correctly.
    /// Additionally, if the next epoch after the current one has the exact
    /// same difficulty, headers for it can be validated as well.
    /// This function should be used for informative purposes,
    /// e.g. to determine whether a retarget must be provided before submitting
    /// a header chain for validation.
    /// @return relayGenesis The height of the earliest block that can be
    /// included in header chains for the relay to validate.
    /// @return currentEpochEnd The height of the last block that can be
    /// included in header chains for the relay to validate.
    function getRelayRange() public view relayActive returns (
        uint256 relayGenesis,
        uint256 currentEpochEnd
    ) {
        relayGenesis = genesisEpoch * 2016;
        currentEpochEnd = (currentEpoch * 2016) + 2015;
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
        require(
            ValidateSPV.validateHeaderWork(digest, target),
            "Invalid work"
        );

        return (digest, target);
    }

    modifier relayActive {
        require(ready, "Relay is not ready for use");
        _;
    }
}