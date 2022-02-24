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

pragma solidity 0.8.4;

import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";
import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {
    CheckBitcoinSigs
} from "@keep-network/bitcoin-spv-sol/contracts/CheckBitcoinSigs.sol";
import "../Bridge.sol";

library FraudVerification {
    using BytesLib for bytes;
    using BTCUtils for bytes;
    using BTCUtils for uint32;

    struct Parameters {
        /// The amount of ETH the party challenging the wallet for fraud needs
        /// to deposit.
        uint256 fraudChallengeDepositAmount; //TODO: Initialize
    }

    struct FraudChallenge {
        address challenger;
        uint256 ethDepositAmount;
        uint32 reportedAt;
        bool defended;
    }

    struct Data {
        Parameters parameters;
        /// Collection of all submitted fraud challenges indexed by challenge
        /// key built as keccak256(walletPublicKey|sighash|v|r|s).
        mapping(uint256 => FraudChallenge) fraudChallenges;
    }

    event FraudChallengeDepositAmountUpdated(
        uint256 newFraudChallengeDepositAmount
    );

    event FraudChallengeSubmitted(
        bytes walletPublicKey,
        bytes32 sighash,
        uint8 v,
        bytes32 r,
        bytes32 s
    );

    event FraudChallengeDefended(
        bytes walletPublicKey,
        bytes32 sighash,
        uint8 v,
        bytes32 r,
        bytes32 s
    );

    /// @notice Submits a wallet fraud challenge.
    /// @param walletPublicKey The public key of the wallet in the uncompressed
    ///                        and unprefixed format (64 bytes).
    /// @param sighash Hash of the data (preimage) used for generating signature
    ///                for the given input.
    /// @param v Signature recovery value.
    /// @param r Signature r value.
    /// @param s Signature s value.
    function submitFraudChallenge(
        Data storage data,
        bytes memory walletPublicKey,
        bytes32 sighash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // TODO: Bitcoin uses signatures in the DER format. From a signature in
        // DER form values r and s can be easily extracted. Check how to obtain
        // the v value. It can take values: 27, 28, 29, 30, 31, 32, 33, 34.
        // https://bitcoin.stackexchange.com/questions/38351/ecdsa-v-r-s-what-is-v
        require(
            msg.value >= data.parameters.fraudChallengeDepositAmount,
            "The amount of ETH deposited is too low"
        );

        bool verificationResult =
            CheckBitcoinSigs.checkSig(walletPublicKey, sighash, v, r, s);
        require(verificationResult, "Signature verification failure");

        uint256 challengeKey =
            uint256(
                keccak256(abi.encodePacked(walletPublicKey, sighash, v, r, s))
            );

        FraudChallenge storage fraudChallenge =
            data.fraudChallenges[challengeKey];
        require(fraudChallenge.reportedAt == 0, "Fraud already challenged");

        fraudChallenge.challenger = msg.sender;
        fraudChallenge.ethDepositAmount = msg.value;
        /* solhint-disable-next-line not-rely-on-time */
        fraudChallenge.reportedAt = uint32(block.timestamp);
        fraudChallenge.defended = false;

        // TODO: Consider emitting the event with walletPublicKey in the
        //       compressed format as it's how we identify wallets in the Bridge.
        emit FraudChallengeSubmitted(walletPublicKey, sighash, v, r, s);
    }

    // TODO: description
    function submitFraudChallengeResponse(
        Data storage data,
        bytes memory walletPublicKey,
        bytes memory preimage,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bool witness,
        mapping(uint256 => Bridge.DepositRequest) storage deposits,
        mapping(uint256 => bool) storage spentMainUTXOs
    ) external {
        // TODO: Consider moving `deposits` and `spentMainUTXOs` to this library
        // and renaming it `UTXO`. It would be responsible for UTXO-related
        // logic, like UTXO frauds.
        bytes32 sighash = preimage.hash256();

        bool verificationResult =
            CheckBitcoinSigs.checkSig(walletPublicKey, sighash, v, r, s);
        require(verificationResult, "Signature verification failure");

        uint256 challengeKey =
            uint256(
                keccak256(abi.encodePacked(walletPublicKey, sighash, v, r, s))
            );

        require(
            data.fraudChallenges[challengeKey].reportedAt > 0,
            "Fraud not challenged"
        );

        require(
            !data.fraudChallenges[challengeKey].defended,
            "Fraud challenge already defended"
        );

        uint32 sighashType = extractSighashType(preimage);
        require(sighashType == 1, "Wrong sighash type");

        if (witness) {
            verifyWitnessPreimage(preimage, deposits, spentMainUTXOs);
        } else {
            verifyNonWitnessPreimage(preimage, deposits, spentMainUTXOs);
        }
        // If we passed the preimage verification, the wallet has successfully
        // defended the fraud challenge.

        // TODO: Reward the wallet for successful fraud challenge response.

        data.fraudChallenges[challengeKey].defended = true;

        // TODO: Consider emitting the event with walletPublicKey in the
        //       compressed format as it's how we identify wallets in the Bridge.
        emit FraudChallengeDefended(walletPublicKey, sighash, v, r, s);
    }

    // TODO: description
    function verifyWitnessPreimage(
        bytes memory preimage,
        mapping(uint256 => Bridge.DepositRequest) storage deposits,
        mapping(uint256 => bool) storage spentMainUTXOs
    ) internal {
        // A preimage created for a witness input contains the outpoint located
        // at a constant offset of 68.
        bytes32 previousOutpointTxIdLe = preimage.extractInputTxIdLeAt(68);
        uint32 previousOutpointIndex =
            BTCUtils.reverseUint32(uint32(preimage.extractTxIndexLeAt(68)));

        uint256 utxoKey =
            uint256(
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
    }

    // TODO: description
    function verifyNonWitnessPreimage(
        bytes memory preimage,
        mapping(uint256 => Bridge.DepositRequest) storage deposits,
        mapping(uint256 => bool) storage spentMainUTXOs
    ) internal {
        // A preimage created during signing of a non-witness input contains
        // all the inputs of the transaction. The input the preimage was
        // generated for can be distinguished from other inputs by looking at
        // unlocking scripts. The unlocking script of such input is non-null
        // while unlocking scripts of other inputs are null.
        (uint256 inputsCompactSizeUintLength, uint256 inputsCount) =
            preimage.parseVarIntAt(4);

        uint256 inputStartingIndex = 4 + 1 + inputsCompactSizeUintLength;
        for (uint256 i = 0; i < inputsCount; i++) {
            bytes32 previousOutpointTxIdLe =
                preimage.extractInputTxIdLeAt(inputStartingIndex);

            uint32 previousOutpointIndex =
                BTCUtils.reverseUint32(
                    uint32(preimage.extractTxIndexLeAt(inputStartingIndex))
                );

            uint256 utxoKey =
                uint256(
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

            // TODO: Check which approach is better:
            //       1) Checking outpoint of every input in the preimage - will
            //          require accessing storage multiple times
            //       2) Check only the outpoint of the input the preimage was
            //          generated for - will require reading the unlocking script
            //          of every input and the searched for input will have a
            //          non-null script.
        }
    }

    // TODO: description
    function setFraudChallengeDepositAmount(
        Data storage self,
        uint256 _newFraudChallengeDepositAmount
    ) internal {
        require(
            _newFraudChallengeDepositAmount > 0,
            "Fraud challenge deposit amount must be > 0"
        );
        self
            .parameters
            .fraudChallengeDepositAmount = _newFraudChallengeDepositAmount;
        emit FraudChallengeDepositAmountUpdated(
            _newFraudChallengeDepositAmount
        );
    }

    // TODO: description
    function extractSighashType(bytes memory preimage)
        internal
        pure
        returns (uint32)
    {
        bytes memory sighashTypeBytes = preimage.lastBytes(4);
        uint32 sighashTypeLE = uint32(sighashTypeBytes.bytesToUint());
        return sighashTypeLE.reverseUint32();
    }
}
