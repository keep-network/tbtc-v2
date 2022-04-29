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

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";

import "./BridgeState.sol";
import "./MergingFunds.sol";
import "./Wallets.sol";

/// @title Bridge donation
/// @notice The library handles the logic for processing external BTC donations.
/// @dev Donations mechanism can be used to re-balance the system through
///      an external donation in those rare cases when the tBTC <-> BTC peg can
///      be violated. Once a donation is made on BTC chain and revealed to
///      the Bridge, the recipient wallet is supposed to merge the donated
///      UTXO with their own main UTXO on BTC chain and submit the proof of
///      that transaction to the Bridge.
library Donation {
    using BridgeState for BridgeState.Storage;
    using MergingFunds for BridgeState.Storage;

    using BTCUtils for bytes;
    using BytesLib for bytes;

    event DonationRevealed(
        bytes20 walletPubKeyHash,
        bytes32 donationTxHash,
        uint32 donationOutputIndex
    );

    /// @notice Reveal an external BTC donation for the given wallet.
    /// @param donationTx Bitcoin donation transaction data, see `BitcoinTx.Info`
    /// @param donationOutputIndex Index of the donation output belonging to
    ///        the donation transaction.
    /// @dev Requirements:
    ///      - The donation transaction output pointed by `donationOutputIndex`
    ///        must be a P2(W)PKH output locking funds on the 20-byte public
    ///        key hash of a known wallet
    ///      - The recipient wallet must be in the Live state
    ///      - The value of the donation output must be greater than or equal
    ///        to the donation dust threshold
    function revealDonation(
        BridgeState.Storage storage self,
        BitcoinTx.Info calldata donationTx,
        uint32 donationOutputIndex
    ) external {
        bytes memory donationOutput = donationTx
            .outputVector
            .extractOutputAtIndex(donationOutputIndex);

        // Extract the output script payload.
        bytes memory walletPubKeyHashBytes = donationOutput.extractHash();
        // Output script payload must refer to a known wallet public key
        // hash which is always 20-byte.
        require(
            walletPubKeyHashBytes.length == 20,
            "Wallet public key hash must have 20 bytes"
        );

        bytes20 walletPubKeyHash = walletPubKeyHashBytes.slice20(0);

        // The next step is making sure that the 20-byte public key hash
        // is actually used in the right context of a P2PKH or P2WPKH
        // output. To do so, we must extract the full script from the output
        // and compare with the expected P2PKH and P2WPKH scripts
        // referring to that 20-byte public key hash. The output consists
        // of an 8-byte value and a variable length script. To extract the
        // script we slice the output starting from 9th byte until the end.
        bytes32 donationOutputScriptKeccak = keccak256(
            donationOutput.slice(8, donationOutput.length - 8)
        );
        // Build the expected P2PKH script which has the following byte
        // format: <0x1976a914> <20-byte PKH> <0x88ac>. According to
        // https://en.bitcoin.it/wiki/Script#Opcodes this translates to:
        // - 0x19: Byte length of the entire script
        // - 0x76: OP_DUP
        // - 0xa9: OP_HASH160
        // - 0x14: Byte length of the public key hash
        // - 0x88: OP_EQUALVERIFY
        // - 0xac: OP_CHECKSIG
        // which matches the P2PKH structure as per:
        // https://en.bitcoin.it/wiki/Transaction#Pay-to-PubkeyHash
        bytes32 walletP2PKHScriptKeccak = keccak256(
            abi.encodePacked(hex"1976a914", walletPubKeyHash, hex"88ac")
        );
        // Build the expected P2WPKH script which has the following format:
        // <0x160014> <20-byte PKH>. According to
        // https://en.bitcoin.it/wiki/Script#Opcodes this translates to:
        // - 0x16: Byte length of the entire script
        // - 0x00: OP_0
        // - 0x14: Byte length of the public key hash
        // which matches the P2WPKH structure as per:
        // https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#P2WPKH
        bytes32 walletP2WPKHScriptKeccak = keccak256(
            abi.encodePacked(hex"160014", walletPubKeyHash)
        );
        // Make sure the actual output script matches either the P2PKH
        // or P2WPKH format.
        require(
            donationOutputScriptKeccak == walletP2PKHScriptKeccak ||
                donationOutputScriptKeccak == walletP2WPKHScriptKeccak,
            "Output must be P2PKH or P2WPKH"
        );

        require(
            self.registeredWallets[walletPubKeyHash].state ==
                Wallets.WalletState.Live,
            "Wallet must be in Live state"
        );

        require(
            donationOutput.extractValue() >= self.donationDustThreshold,
            "Donation amount too small"
        );

        bytes32 donationTxHash = abi
            .encodePacked(
                donationTx.version,
                donationTx.inputVector,
                donationTx.outputVector,
                donationTx.locktime
            )
            .hash256View();

        self.requestMergingFunds(donationTxHash, donationOutputIndex);

        emit DonationRevealed(
            walletPubKeyHash,
            donationTxHash,
            donationOutputIndex
        );
    }

    // TODO: Implement `submitDonationMergeProof` that will call
    //       `self.submitMergingFundsProof` from `MovingFunds` library.
}
