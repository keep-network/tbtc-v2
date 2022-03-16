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
import {IWalletRegistry as EcdsaWalletRegistry} from "@keep-network/ecdsa/contracts/api/IWalletRegistry.sol";
import {EcdsaDkg} from "@keep-network/ecdsa/contracts/libraries/EcdsaDkg.sol";

import "./BitcoinTx.sol";
import "./EcdsaLib.sol";

/// @title Wallet library
/// @notice Library responsible for handling integration between Bridge
///         contract and ECDSA wallets.
library Wallets {
    using BTCUtils for bytes;

    /// @notice Struct that groups the state managed by the library.
    struct Data {
        // ECDSA Wallet Registry contract handle.
        EcdsaWalletRegistry registry;
        // Determines how frequently a new wallet creation can be requested.
        uint32 creationPeriod;
        // The minimum BTC threshold that is used to decide about wallet
        // creation or closing.
        uint64 minBtcBalance;
        // The maximum BTC threshold that is used to decide about wallet
        // creation or closing.
        uint64 maxBtcBalance;
        // TODO: Make sure the `activeWalletPubKeyHash` is zeroed in case
        //       the active wallet becomes non-Live.
        // 20-byte wallet public key hash being reference to the currently
        // active wallet. Can be unset to the zero value under certain
        // circumstances.
        bytes20 activeWalletPubKeyHash;
        // Maps the 20-byte wallet public key hash (computed using Bitcoin
        // HASH160 over the compressed ECDSA public key) to the basic wallet
        // information like state and pending redemptions value.
        mapping(bytes20 => Wallet) registeredWallets;
    }

    /// @notice Represents wallet state:
    enum WalletState {
        /// @dev The wallet is unknown to the Bridge.
        Unknown,
        /// @dev The wallet can sweep deposits and accept redemption requests.
        Live,
        /// @dev The wallet was deemed unhealthy and is expected to move their
        ///      outstanding funds to another wallet. The wallet can still
        ///      fulfill their pending redemption requests although new
        ///      redemption requests and new deposit reveals are not accepted.
        MovingFunds,
        /// @dev The wallet moved or redeemed all their funds and cannot
        ///      perform any action.
        Closed,
        /// @dev The wallet committed a fraud that was reported. The wallet is
        ///      blocked and can not perform any actions in the Bridge.
        ///      Off-chain coordination with the wallet operators is needed to
        ///      recover funds.
        Terminated
    }

    /// @notice Holds information about a wallet.
    struct Wallet {
        // Identifier of a ECDSA Wallet registered in the ECDSA Wallet Registry.
        bytes32 ecdsaWalletID;
        // Latest wallet's main UTXO hash computed as
        // keccak256(txHash | txOutputIndex | txOutputValue). The `tx` prefix
        // refers to the transaction which created that main UTXO. The `txHash`
        // is `bytes32` (ordered as in Bitcoin internally), `txOutputIndex`
        // an `uint32`, and `txOutputValue` an `uint64` value.
        bytes32 mainUtxoHash;
        // The total redeemable value of pending redemption requests targeting
        // that wallet.
        uint64 pendingRedemptionsValue;
        // UNIX timestamp the wallet was created at.
        uint32 createdAt;
        // Current state of the wallet.
        WalletState state;
    }

    event NewWalletRequested();

    event NewWalletRegistered(
        bytes32 indexed ecdsaWalletID,
        bytes20 indexed walletPubKeyHash160
    );

    /// @notice Initializes state invariants.
    /// @param registry ECDSA Wallet Registry reference
    /// @dev Requirements:
    ///      - ECDSA Wallet Registry address must not be initialized
    function init(Data storage self, EcdsaWalletRegistry registry) external {
        require(
            address(self.registry) == address(0),
            "ECDSA Wallet Registry address already set"
        );

        self.registry = registry;
    }

    /// @notice Sets the wallet creation period.
    /// @param creationPeriod New value of the wallet creation period
    function setCreationPeriod(Data storage self, uint32 creationPeriod)
        external
    {
        self.creationPeriod = creationPeriod;
    }

    /// @notice Sets the minimum and maximum BTC balance parameters.
    /// @param minBtcBalance New value of the minimum BTC balance
    /// @param maxBtcBalance New value of the maximum BTC balance
    /// @dev Requirements:
    ///      - Minimum BTC balance must be lower than maximum BTC balance
    function setBtcBalanceRange(
        Data storage self,
        uint64 minBtcBalance,
        uint64 maxBtcBalance
    ) external {
        require(
            minBtcBalance < maxBtcBalance,
            "Minimum must be lower than the maximum"
        );

        self.minBtcBalance = minBtcBalance;
        self.maxBtcBalance = maxBtcBalance;
    }

    /// @notice Requests creation of a new wallet. This function just
    ///         forms a request and the creation process is performed
    ///         asynchronously. Outcome of that process should be delivered
    ///         using `registerNewWallet` function.
    /// @param activeWalletMainUtxo Data of the active wallet's main UTXO, as
    ///        currently known on the Ethereum chain.
    /// @dev Requirements:
    ///      - `activeWalletMainUtxo` components must point to the recent main
    ///        UTXO of the given active wallet, as currently known on the
    ///        Ethereum chain. If there is no active wallet at the moment, or
    ///        the active wallet has no main UTXO, this parameter can be
    ///        empty as it is ignored.
    ///      - Wallet creation must not be in progress
    ///      - If the active wallet is set, one of the following
    ///        conditions must be true:
    ///        - The active wallet BTC balance is above the minimum threshold
    ///          and the active wallet is old enough, i.e. the creation period
    ///           was elapsed since its creation time
    ///        - The active wallet BTC balance is above the maximum threshold
    ///        If the active wallet is not set at the moment, there is no
    ///        additional conditions.
    function requestNewWallet(
        Data storage self,
        BitcoinTx.UTXO calldata activeWalletMainUtxo
    ) external {
        // TODO: Uncomment when `getWalletCreationState` will be exposed by
        //       EcdsaWalletRegistry.
        //
        // require(
        //     self.registry.getWalletCreationState() == EcdsaDkg.State.IDLE,
        //     "Wallet creation already in progress"
        // );

        bytes20 activeWalletPubKeyHash = self.activeWalletPubKeyHash;

        // If the active wallet is set, fetch this wallet's details from
        // storage to perform conditions check. The `registerNewWallet`
        // function guarantees an active wallet is always one of the
        // registered ones.
        if (activeWalletPubKeyHash != bytes20(0)) {
            uint64 activeWalletBtcBalance = getWalletBtcBalance(
                self,
                activeWalletPubKeyHash,
                activeWalletMainUtxo
            );
            uint32 activeWalletCreatedAt = self
                .registeredWallets[activeWalletPubKeyHash]
                .createdAt;
            /* solhint-disable-next-line not-rely-on-time */
            bool activeWalletOldEnough = block.timestamp >=
                activeWalletCreatedAt + self.creationPeriod;

            require(
                (activeWalletOldEnough &&
                    activeWalletBtcBalance >= self.minBtcBalance) ||
                    activeWalletBtcBalance >= self.maxBtcBalance,
                "Wallet creation conditions are not met"
            );
        }

        emit NewWalletRequested();

        self.registry.requestNewWallet();
    }

    /// @notice Gets BTC balance for given wallet.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @param walletMainUtxo Data of the wallet's main UTXO, as currently
    ///        known on the Ethereum chain.
    /// @return walletBtcBalance Current BTC balance for given wallet.
    /// @dev Requirements:
    ///      - `walletMainUtxo` components must point to the recent main UTXO
    ///        of the given wallet, as currently known on the Ethereum chain.
    ///        If the wallet has no main UTXO, this parameter can be empty as it
    ///        is ignored.
    function getWalletBtcBalance(
        Data storage self,
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata walletMainUtxo
    ) internal view returns (uint64 walletBtcBalance) {
        bytes32 walletMainUtxoHash = self
            .registeredWallets[walletPubKeyHash]
            .mainUtxoHash;

        // If the wallet has a main UTXO hash set, cross-check it with the
        // provided plain-text parameter and get the transaction output value
        // as BTC balance. Otherwise, the BTC balance is just zero.
        if (walletMainUtxoHash != bytes32(0)) {
            require(
                keccak256(
                    abi.encodePacked(
                        walletMainUtxo.txHash,
                        walletMainUtxo.txOutputIndex,
                        walletMainUtxo.txOutputValue
                    )
                ) == walletMainUtxoHash,
                "Invalid wallet main UTXO data"
            );

            walletBtcBalance = walletMainUtxo.txOutputValue;
        }

        return walletBtcBalance;
    }

    /// @notice Registers a new wallet. This function should be called
    ///         after the wallet creation process initiated using
    ///         `requestNewWallet` completes and brings the outcomes.
    /// @param ecdsaWalletID Wallet's unique identifier.
    /// @param publicKeyX Wallet's public key's X coordinate.
    /// @param publicKeyY Wallet's public key's Y coordinate.
    /// @dev Requirements:
    ///      - The only caller authorized to call this function is `registry`
    ///      - Given wallet data must not belong to an already registered wallet
    function registerNewWallet(
        Data storage self,
        bytes32 ecdsaWalletID,
        bytes32 publicKeyX,
        bytes32 publicKeyY
    ) external {
        require(
            msg.sender == address(self.registry),
            "Caller is not the ECDSA Wallet Registry"
        );

        // Compress wallet's public key and calculate Bitcoin's hash160 of it.
        bytes20 walletPubKeyHash = bytes20(
            EcdsaLib.compressPublicKey(publicKeyX, publicKeyY).hash160()
        );

        Wallet storage wallet = self.registeredWallets[walletPubKeyHash];
        require(
            wallet.state == WalletState.Unknown,
            "ECDSA wallet has been already registered"
        );
        wallet.ecdsaWalletID = ecdsaWalletID;
        wallet.state = WalletState.Live;
        /* solhint-disable-next-line not-rely-on-time */
        wallet.createdAt = uint32(block.timestamp);

        // Set the freshly created wallet as the new active wallet.
        self.activeWalletPubKeyHash = walletPubKeyHash;

        emit NewWalletRegistered(ecdsaWalletID, walletPubKeyHash);
    }
}
