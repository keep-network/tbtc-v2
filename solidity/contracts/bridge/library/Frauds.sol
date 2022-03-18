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

import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";
import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {CheckBitcoinSigs} from "@keep-network/bitcoin-spv-sol/contracts/CheckBitcoinSigs.sol";
import "../EcdsaLib.sol";
import "../Bridge.sol";

library Frauds {
    using BytesLib for bytes;
    using BTCUtils for bytes;
    using BTCUtils for uint32;
    using EcdsaLib for bytes;

    struct Data {
        ///  The amount of stake slashed from each member of a wallet for a fraud.
        uint256 slashingAmount; //TODO: Initialize
        /// The percentage of the notifier reward from the staking contract
        /// the notifier of a fraud receives. The value is in the range [0, 100].
        uint256 notifierRewardMultiplier; //TODO: Initialize
        /// The amount of time the wallet has to defeat a fraud challenge.
        uint256 challengeDefeatTimeout; //TODO: Initialize
        /// The amount of ETH the party challenging the wallet for fraud needs
        /// to deposit.
        uint256 challengeDepositAmount; //TODO: Initialize
        /// Collection of all submitted fraud challenges indexed by challenge
        /// key built as keccak256(walletPublicKey|sighash|v|r|s).
        mapping(uint256 => FraudChallenge) challenges;
    }

    struct FraudChallenge {
        // The address of the party challenging the wallet.
        address challenger;
        // The amount of ETH the challenger deposited.
        uint256 depositAmount;
        // The timestamp the challenge was submitted at.
        uint32 reportedAt;
        // The flag indicating whether the challenge has been closed.
        bool closed;
    }

    /// @notice Represents Bitcoin signature in the R/S/V format.
    struct RSVSignature {
        /// @notice Signature r value.
        bytes32 r;
        /// @notice Signature s value.
        bytes32 s;
        /// @notice Signature recovery value.
        uint8 v;
    }

    event FraudSlashingAmountUpdated(uint256 newFraudSlashingAmount);

    event FraudNotifierRewardMultiplierUpdated(
        uint256 newFraudNotifierRewardMultiplier
    );

    event FraudChallengeDefeatTimeoutUpdated(
        uint256 newFraudChallengeDefeatTimeout
    );

    event FraudChallengeDepositAmountUpdated(
        uint256 newFraudChallengeDepositAmount
    );

    event FraudChallengeSubmitted(
        bytes20 walletPublicKeyHash,
        bytes32 sighash,
        uint8 v,
        bytes32 r,
        bytes32 s
    );

    event FraudChallengeDefeated(
        bytes20 walletPublicKeyHash,
        bytes32 sighash,
        uint8 v,
        bytes32 r,
        bytes32 s
    );

    event FraudChallengeDefeatTimeout(
        bytes20 walletPublicKeyHash,
        bytes32 sighash,
        uint8 v,
        bytes32 r,
        bytes32 s
    );

    /// @notice Submits a fraud challenge indicating that a UTXO being under
    ///         wallet control was unlocked by the wallet but was not used
    ///         according to the protocol rules. That means the wallet signed
    ///         a transaction input pointing to that UTXO and there is a unique
    ///         sighash and signature pair associated with that input. This
    ///         function uses those parameters to create a fraud accusation that
    ///         proves a given transaction input unlocking the given UTXO was
    ///         actually signed by the wallet. This function cannot determine
    ///         whether the transaction was actually broadcast and the input was
    ///         consumed in a fraudulent way so it just opens a challenge period
    ///         during which the wallet can defeat the challenge by submitting
    ///         proof of a transaction that consumes the given input according
    ///         to protocol rules. To prevent spurious allegations, the caller
    ///         must deposit ETH that is returned back upon justified fraud
    ///         challenge or confiscated otherwise.
    /// @param walletPublicKey The public key of the wallet in the uncompressed
    ///        and unprefixed format (64 bytes).
    /// @param sighash The hash that was used to produce the ECDSA signature
    ///        that is the subject of the fraud claim. This hash is constructed
    ///        by applying double SHA-256 over a serialized subset of the
    ///        transaction. The exact subset used as hash preimage depends on
    ///        the transaction input the signature is produced for. See BIP-143
    ///        for reference.
    /// @param signature Bitcoin signature in the R/S/V format.
    /// @dev Requirements:
    ///      - Wallet behind `walletPubKey` must be active
    ///      - The challenger must send appropriate amount of ETH used as
    ///        fraud challenge deposit
    ///      - The signature (represented by r, s and v) must be generated by
    ///        the wallet behind `walletPubKey` during signing of `sighash`.
    ///      - Wallet can be challenged for the given signature only once.
    function submitFraudChallenge(
        Data storage self,
        bytes memory walletPublicKey,
        bytes32 sighash,
        RSVSignature calldata signature
    ) external {
        require(
            msg.value >= self.challengeDepositAmount,
            "The amount of ETH deposited is too low"
        );

        require(
            CheckBitcoinSigs.checkSig(
                walletPublicKey,
                sighash,
                signature.v,
                signature.r,
                signature.s
            ),
            "Signature verification failure"
        );

        uint256 challengeKey = uint256(
            keccak256(
                abi.encodePacked(
                    walletPublicKey,
                    sighash,
                    signature.v,
                    signature.r,
                    signature.s
                )
            )
        );

        FraudChallenge storage challenge = self.challenges[challengeKey];
        require(challenge.reportedAt == 0, "Fraud challenge already exists");

        challenge.challenger = msg.sender;
        challenge.depositAmount = msg.value;
        /* solhint-disable-next-line not-rely-on-time */
        challenge.reportedAt = uint32(block.timestamp);
        challenge.closed = false;

        bytes memory compressedWalletPublicKey = EcdsaLib.compressPublicKey(
            walletPublicKey.slice32(0),
            walletPublicKey.slice32(32)
        );
        bytes20 walletPubKeyHash = bytes20(compressedWalletPublicKey.hash160());

        emit FraudChallengeSubmitted(
            walletPubKeyHash,
            sighash,
            signature.v,
            signature.r,
            signature.s
        );
    }

    /// @notice Allows to defeat a pending fraud challenge against a wallet if
    ///         the transaction that spends the UTXO follows the protocol rules.
    ///         In order to defeat the challenge the same `walletPublicKey` and
    ///         signature (represented by `r`, `s` and `v`) must be provided as
    ///         were used in the fraud challenge. Additionally a preimage must
    ///         be provided which was used to calculate the sighash during input
    ///         signing. The fraud challenge defeat attempt will only succeed if
    ///         the inputs in the preimage are considered honestly spent by the
    ///         wallet. Therefore the transaction spending the UTXO must be
    ///         proven in the Bridge before a challenge defeat is called.
    ///         If successfully defeated, the fraud challenge is closed and the
    ///         amount of ether deposited by the challenger is sent to the
    ///         treasury.
    /// @param walletPublicKey The public key of the wallet in the uncompressed
    ///        and unprefixed format (64 bytes).
    /// @param preimage The preimage which produces sighash used to generate the
    ///        ECDSA signature that is the subject of the fraud claim. It is a
    ///        serialized subset of the transaction. The exact subset used as
    ///        the preimage depends on the transaction input the signature is
    ///        produced for. See BIP-143 for reference.
    /// @param signature Bitcoin signature in the R/S/V format.
    /// @param witness Flag indicating whether the preimage was produced for a
    ///        witness input. True for witness, false for non-witness input.
    /// @param treasury Treasury associated with the Bridge.
    /// @param deposits Collection of deposits from the Bridge.
    /// @param spentMainUTXOs Collection of spent main UTXOs from the Bridge.
    /// @dev Requirements:
    ///      - `walletPublicKey`, signature (represented by `r`, `s` and `v`) as
    ///        well `sighash` calculated as hash256(preimage) must identify an
    ///        open fraud challenge
    ///      - the preimage must be generated according to the protocol
    ///      - before a defeat attempt is made the transaction that spends the
    ///        given UTXO must be proven in the Bridge.
    function defeatFraudChallenge(
        Data storage self,
        bytes memory walletPublicKey,
        bytes memory preimage,
        Frauds.RSVSignature calldata signature,
        bool witness,
        address treasury,
        mapping(uint256 => Bridge.DepositRequest) storage deposits,
        mapping(uint256 => bool) storage spentMainUTXOs
    ) external {
        bytes32 sighash = preimage.hash256();

        uint256 challengeKey = uint256(
            keccak256(
                abi.encodePacked(
                    walletPublicKey,
                    sighash,
                    signature.v,
                    signature.r,
                    signature.s
                )
            )
        );

        FraudChallenge storage challenge = self.challenges[challengeKey];

        require(challenge.reportedAt > 0, "Fraud challenge does not exist");
        require(!challenge.closed, "Fraud challenge closed");

        // Ensure SIGHASH_ALL type was used during signing, which is represented
        // by type value `1`.
        require(extractSighashType(preimage) == 1, "Wrong sighash type");

        if (witness) {
            verifyWitnessPreimage(preimage, deposits, spentMainUTXOs);
        } else {
            verifyNonWitnessPreimage(preimage, deposits, spentMainUTXOs);
        }
        // If we passed the preimage verification, the wallet has successfully
        // defeated the fraud challenge.

        challenge.closed = true;

        // Send the ether deposited by the challenger to the treasury
        /* solhint-disable avoid-low-level-calls */
        // slither-disable-next-line low-level-calls
        treasury.call{gas: 5000, value: challenge.depositAmount}("");
        /* solhint-enable avoid-low-level-calls */

        bytes memory compressedWalletPublicKey = EcdsaLib.compressPublicKey(
            walletPublicKey.slice32(0),
            walletPublicKey.slice32(32)
        );
        bytes20 walletPubKeyHash = bytes20(compressedWalletPublicKey.hash160());

        emit FraudChallengeDefeated(
            walletPubKeyHash,
            sighash,
            signature.v,
            signature.r,
            signature.s
        );
    }

    /// @notice Notifies about defeat timeout for the given fraud challenge.
    ///         Can be called only if there was a fraud challenge identified by
    ///         the provided `walletPublicKey`, `sighash` and signature
    ///         (represented by `r`, `s` and `v`) and it was not defeated on time.
    ///         The amount of time that needs to pass after a fraud challenge is
    ///         reported is indicated by the `challengeDefeatTimeout`. After a
    ///         successful fraud challenge defeat timeout notification the fraud
    ///         challenge is closed, the stake of each operator is slashed, the
    ///         ether deposited is returned to the challenger and the challenger
    ///         is rewarded.
    /// @param walletPublicKey The public key of the wallet in the uncompressed
    ///        and unprefixed format (64 bytes).
    /// @param sighash The hash that was used to produce the ECDSA signature
    ///        that is the subject of the fraud claim. This hash is constructed
    ///        by applying double SHA-256 over a serialized subset of the
    ///        transaction. The exact subset used as hash preimage depends on
    ///        the transaction input the signature is produced for. See BIP-143
    ///        for reference.
    /// @param signature Bitcoin signature in the R/S/V format.
    /// @dev Requirements:
    ///      - `walletPublicKey`, signature (represented by `r`, `s` and `v`)
    ///        and `sighash` must identify an open fraud challenge
    ///      - the amount of time indicated by `challengeDefeatTimeout` must pass
    ///        after the challenge was reported
    function notifyFraudChallengeDefeatTimeout(
        Data storage self,
        bytes memory walletPublicKey,
        bytes32 sighash,
        Frauds.RSVSignature calldata signature
    ) external {
        uint256 challengeKey = uint256(
            keccak256(
                abi.encodePacked(
                    walletPublicKey,
                    sighash,
                    signature.v,
                    signature.r,
                    signature.s
                )
            )
        );

        FraudChallenge storage challenge = self.challenges[challengeKey];
        require(challenge.reportedAt > 0, "Fraud challenge does not exist");
        require(!challenge.closed, "Fraud challenge is closed");
        require(
            /* solhint-disable-next-line not-rely-on-time */
            block.timestamp >=
                challenge.reportedAt + self.challengeDefeatTimeout,
            "Fraud challenge defeat period did not time out yet"
        );

        // TODO: Slash the wallet
        // TODO: Reward the challenger

        challenge.closed = true;

        // Return the ether deposited by the challenger
        /* solhint-disable avoid-low-level-calls */
        // slither-disable-next-line low-level-calls
        challenge.challenger.call{gas: 5000, value: challenge.depositAmount}(
            ""
        );
        /* solhint-enable avoid-low-level-calls */

        bytes memory compressedWalletPublicKey = EcdsaLib.compressPublicKey(
            walletPublicKey.slice32(0),
            walletPublicKey.slice32(32)
        );
        bytes20 walletPubKeyHash = bytes20(compressedWalletPublicKey.hash160());

        emit FraudChallengeDefeatTimeout(
            walletPubKeyHash,
            sighash,
            signature.v,
            signature.r,
            signature.s
        );
    }

    /// @notice Verifies whether the witness input in the provided preimage has
    ///         an outpoint that has been proven to be correctly spent in the
    ///         Bridge.
    /// @param preimage Serialized subset of the transaction. See BIP-143
    ///        for reference.
    /// @param deposits Information on deposits in the Bridge.
    /// @param spentMainUTXOs Information on the spent main UTXO, which are main
    ///        UTXOs that were used as inputs in transactions processed in the
    ///        Bridge.
    /// @dev As the preimage was generated during signing of a witness input,
    ///      there is only one outpoint in the preimage, even though the
    ///      transaction could have multiple inputs.
    function verifyWitnessPreimage(
        bytes memory preimage,
        mapping(uint256 => Bridge.DepositRequest) storage deposits,
        mapping(uint256 => bool) storage spentMainUTXOs
    ) internal {
        // The expected structure of the preimage created during signing of a
        // witness input:
        // - transaction version (4 bytes)
        // - hash of previous outpoints of all inputs (32 bytes)
        // - hash of sequences of all inputs (32 bytes)
        // - outpoint (hash + index) of the input being signed (36 bytes)
        // - the unlocking script of the input (variable length)
        // - value of the outpoint (8 bytes)
        // - sequence of the input being signed (4 bytes)
        // - hash of all outputs (32 bytes)
        // - transaction locktime (4 bytes)
        // - sighash type (4 bytes)

        // The outpoint (hash and index) is located at the constant offset of
        // 68 (4 + 32 + 32).
        bytes32 previousOutpointTxIdLe = preimage.extractInputTxIdLeAt(68);
        uint32 previousOutpointIndex = BTCUtils.reverseUint32(
            uint32(preimage.extractTxIndexLeAt(68))
        );

        uint256 utxoKey = uint256(
            keccak256(
                abi.encodePacked(previousOutpointTxIdLe, previousOutpointIndex)
            )
        );

        // Check that the UTXO is among the correctly spent UTXOs.
        require(
            deposits[utxoKey].sweptAt > 0 || spentMainUTXOs[utxoKey],
            "Spent UTXO not found among correctly spent UTXOs"
        );
    }

    /// @notice Verifies whether the inputs in the provided preimage have
    ///         outpoints that has been proven to be correctly spent in the
    ///         Bridge.
    /// @param preimage Serialized subset of the transaction. See BIP-143
    ///        for reference.
    /// @param deposits Information on deposits in the Bridge.
    /// @param spentMainUTXOs Information on the spent main UTXO, which are main
    ///        UTXOs that were used as inputs in transactions successfully
    ///        processed in the Bridge.
    /// @dev As the preimage was generated during signing of a non-witness input,
    ///      there can be multiple outpoints in the preimage, both witness and
    ///      non-witness. The input the preimage was generated for could be
    ///      found by looking at unlocking scripts - it has a non-zero unlocking
    ///      script, while other inputs have `00` set as unlocking scripts.
    ///      For simplicity, we verify all the inputs, not just the one with a
    ///      non-zero unlocking script.
    function verifyNonWitnessPreimage(
        bytes memory preimage,
        mapping(uint256 => Bridge.DepositRequest) storage deposits,
        mapping(uint256 => bool) storage spentMainUTXOs
    ) internal {
        // The expected structure of the preimage created during signing of a
        // non-witness input:
        // - transaction version (4 bytes)
        // - number of inputs as written as varint (1 byte, 3 bytes, 5 bytes or
        //   9 bytes)
        // - for each input
        //   - outpoint (hash and index) (36 bytes)
        //   - unlocking script for the input being signed (variable length)
        //     or `00` for all other inputs (1 byte)
        //   - input sequence (4 bytes)
        // - outputs (variable length)
        // - transaction locktime (4 bytes)
        // - sighash type (4 bytes)

        // The input data begins at the constant offset of 4 (the first 4 bytes
        // are for the transaction version).
        (uint256 inputsCompactSizeUintLength, uint256 inputsCount) = preimage
            .parseVarIntAt(4);

        // To determine the first input starting index, we must jump 4 bytes
        // over the transaction version length and the compactSize uint which
        // prepends the input vector. One byte must be added because
        // `BtcUtils.parseVarInt` does not include compactSize uint tag in the
        // returned length.
        //
        // For >= 0 && <= 252, `BTCUtils.determineVarIntDataLengthAt`
        // returns `0`, so we jump over one byte of compactSize uint.
        //
        // For >= 253 && <= 0xffff there is `0xfd` tag,
        // `BTCUtils.determineVarIntDataLengthAt` returns `2` (no
        // tag byte included) so we need to jump over 1+2 bytes of
        // compactSize uint.
        //
        // Please refer `BTCUtils` library and compactSize uint
        // docs in `BitcoinTx` library for more details.
        uint256 inputStartingIndex = 4 + 1 + inputsCompactSizeUintLength;
        for (uint256 i = 0; i < inputsCount; i++) {
            bytes32 previousOutpointTxIdLe = preimage.extractInputTxIdLeAt(
                inputStartingIndex
            );

            uint32 previousOutpointIndex = BTCUtils.reverseUint32(
                uint32(preimage.extractTxIndexLeAt(inputStartingIndex))
            );

            uint256 utxoKey = uint256(
                keccak256(
                    abi.encodePacked(
                        previousOutpointTxIdLe,
                        previousOutpointIndex
                    )
                )
            );

            // Check that the UTXO is among the correctly spent UTXOs.
            require(
                deposits[utxoKey].sweptAt > 0 || spentMainUTXOs[utxoKey],
                "Spent UTXO not found among correctly spent UTXOs"
            );

            inputStartingIndex += preimage.determineInputLengthAt(
                inputStartingIndex
            );
        }
    }

    /// @notice Sets the new value for the `slashingAmount` parameter.
    /// @param _newSlashingAmount the new value for `slashingAmount`.
    function setSlashingAmount(Data storage self, uint256 _newSlashingAmount)
        external
    {
        self.slashingAmount = _newSlashingAmount;
        emit FraudSlashingAmountUpdated(_newSlashingAmount);
    }

    /// @notice Sets the new value for the `notifierRewardMultiplier` parameter.
    /// @param _newNotifierRewardMultiplier the new value for `notifierRewardMultiplier`.
    /// @dev The value of `notifierRewardMultiplier` must be <= 100.
    function setNotifierRewardMultiplier(
        Data storage self,
        uint256 _newNotifierRewardMultiplier
    ) external {
        require(
            _newNotifierRewardMultiplier <= 100,
            "Fraud notifier reward multiplier must be <= 100"
        );
        self.notifierRewardMultiplier = _newNotifierRewardMultiplier;
        emit FraudNotifierRewardMultiplierUpdated(_newNotifierRewardMultiplier);
    }

    /// @notice Sets the new value for the `challengeDefeatTimeout` parameter.
    /// @param _newChallengeDefeatTimeout the new value for `challengeDefeatTimeout`.
    /// @dev The value of `challengeDefeatTimeout` must be > 0.
    function setChallengeDefeatTimeout(
        Data storage self,
        uint256 _newChallengeDefeatTimeout
    ) external {
        require(
            _newChallengeDefeatTimeout > 0,
            "Fraud challenge defeat timeout must be > 0"
        );
        self.challengeDefeatTimeout = _newChallengeDefeatTimeout;
        emit FraudChallengeDefeatTimeoutUpdated(_newChallengeDefeatTimeout);
    }

    /// @notice Sets the new value for the `challengeDepositAmount` parameter.
    /// @param _newChallengeDepositAmount the new value for `challengeDepositAmount`.
    /// @dev The value of `challengeDepositAmount` must be > 0.
    function setChallengeDepositAmount(
        Data storage self,
        uint256 _newChallengeDepositAmount
    ) external {
        require(
            _newChallengeDepositAmount > 0,
            "Fraud challenge deposit amount must be > 0"
        );
        self.challengeDepositAmount = _newChallengeDepositAmount;
        emit FraudChallengeDepositAmountUpdated(_newChallengeDepositAmount);
    }

    /// @notice Extracts the sighash type from the given preimage.
    /// @param preimage Serialized subset of the transaction. See BIP-143 for
    ///        reference.
    /// @dev Sighash type is stored as the last 4 bytes in the preimage (little
    ///      endian).
    /// @return sighashType Sighash type as a 32-bit integer (big endian).
    function extractSighashType(bytes memory preimage)
        internal
        pure
        returns (uint32 sighashType)
    {
        bytes memory sighashTypeBytes = preimage.lastBytes(4);
        uint32 sighashTypeLE = uint32(sighashTypeBytes.bytesToUint());
        return sighashTypeLE.reverseUint32();
    }
}
