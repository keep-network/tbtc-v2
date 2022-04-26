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
import {EcdsaDkg} from "@keep-network/ecdsa/contracts/libraries/EcdsaDkg.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import "./BitcoinTx.sol";
import "./EcdsaLib.sol";
import "./BridgeState.sol";

/// @title Wallet library
/// @notice Library responsible for handling integration between Bridge
///         contract and ECDSA wallets.
library Wallets {
    using BTCUtils for bytes;

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
        // UNIX timestamp indicating the moment the wallet was requested to
        // move their funds.
        uint32 movingFundsRequestedAt;
        // Current state of the wallet.
        WalletState state;
        // Moving funds target wallet commitment submitted by the wallet. It
        // is built by applying the keccak256 hash over the list of 20-byte
        // public key hashes of the target wallets.
        bytes32 movingFundsTargetWalletsCommitmentHash;
    }

    event NewWalletRequested();

    event NewWalletRegistered(
        bytes32 indexed ecdsaWalletID,
        bytes20 indexed walletPubKeyHash
    );

    event WalletMovingFunds(
        bytes32 indexed ecdsaWalletID,
        bytes20 indexed walletPubKeyHash
    );

    event WalletClosed(
        bytes32 indexed ecdsaWalletID,
        bytes20 indexed walletPubKeyHash
    );

    event WalletTerminated(
        bytes32 indexed ecdsaWalletID,
        bytes20 indexed walletPubKeyHash
    );

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
    function requestNewWallet(
        BridgeState.Storage storage self,
        BitcoinTx.UTXO calldata activeWalletMainUtxo
    ) external {
        require(
            self.ecdsaWalletRegistry.getWalletCreationState() ==
                EcdsaDkg.State.IDLE,
            "Wallet creation already in progress"
        );

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
                activeWalletCreatedAt + self.walletCreationPeriod;

            require(
                (activeWalletOldEnough &&
                    activeWalletBtcBalance >= self.walletMinBtcBalance) ||
                    activeWalletBtcBalance >= self.walletMaxBtcBalance,
                "Wallet creation conditions are not met"
            );
        }

        emit NewWalletRequested();

        self.ecdsaWalletRegistry.requestNewWallet();
    }

    /// @notice Gets BTC balance for given the wallet.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @param walletMainUtxo Data of the wallet's main UTXO, as currently
    ///        known on the Ethereum chain.
    /// @return walletBtcBalance Current BTC balance for the given wallet.
    /// @dev Requirements:
    ///      - `walletMainUtxo` components must point to the recent main UTXO
    ///        of the given wallet, as currently known on the Ethereum chain.
    ///        If the wallet has no main UTXO, this parameter can be empty as it
    ///        is ignored.
    function getWalletBtcBalance(
        BridgeState.Storage storage self,
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
        BridgeState.Storage storage self,
        bytes32 ecdsaWalletID,
        bytes32 publicKeyX,
        bytes32 publicKeyY
    ) external {
        require(
            msg.sender == address(self.ecdsaWalletRegistry),
            "Caller is not the ECDSA Wallet Registry"
        );

        // Compress wallet's public key and calculate Bitcoin's hash160 of it.
        bytes20 walletPubKeyHash = bytes20(
            EcdsaLib.compressPublicKey(publicKeyX, publicKeyY).hash160View()
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

        self.liveWalletsCount++;

        emit NewWalletRegistered(ecdsaWalletID, walletPubKeyHash);
    }

    /// @notice Handles a notification about a wallet heartbeat failure and
    ///         triggers the wallet moving funds process.
    /// @param publicKeyX Wallet's public key's X coordinate.
    /// @param publicKeyY Wallet's public key's Y coordinate.
    /// @dev Requirements:
    ///      - The only caller authorized to call this function is `registry`
    ///      - Wallet must be in Live state
    function notifyWalletHeartbeatFailed(
        BridgeState.Storage storage self,
        bytes32 publicKeyX,
        bytes32 publicKeyY
    ) external {
        require(
            msg.sender == address(self.ecdsaWalletRegistry),
            "Caller is not the ECDSA Wallet Registry"
        );

        // Compress wallet's public key and calculate Bitcoin's hash160 of it.
        bytes20 walletPubKeyHash = bytes20(
            EcdsaLib.compressPublicKey(publicKeyX, publicKeyY).hash160View()
        );

        require(
            self.registeredWallets[walletPubKeyHash].state == WalletState.Live,
            "ECDSA wallet must be in Live state"
        );

        moveFunds(self, walletPubKeyHash);
    }

    /// @notice Handles a notification about a wallet redemption timeout
    ///         and requests slashing of the wallet operators. Triggers the
    ///         wallet moving funds process only if the wallet is still in the
    ///         Live state. That means multiple action timeouts can be reported
    ///         for the same wallet but only the first report requests the
    ///         wallet to move their funds.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @dev Requirements:
    ///      - The wallet must be in the `Live` or `MovingFunds` state
    function notifyWalletTimedOutRedemption(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash
    ) internal {
        WalletState walletState = self
            .registeredWallets[walletPubKeyHash]
            .state;

        require(
            walletState == WalletState.Live ||
                walletState == WalletState.MovingFunds,
            "ECDSA wallet must be in Live or MovingFunds state"
        );

        if (walletState == WalletState.Live) {
            moveFunds(self, walletPubKeyHash);
        }

        // TODO: Perform slashing of wallet operators and transfer some of the
        //       slashed tokens to the caller of this function.
    }

    /// @notice Notifies that the wallet is either old enough or has too few
    ///         satoshis left and qualifies to be closed.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @param walletMainUtxo Data of the wallet's main UTXO, as currently
    ///        known on the Ethereum chain.
    /// @dev Requirements:
    ///      - Wallet must not be set as the current active wallet
    ///      - Wallet must exceed the wallet maximum age OR the wallet BTC
    ///        balance must be lesser than the minimum threshold. If the latter
    ///        case is true, the `walletMainUtxo` components must point to the
    ///        recent main UTXO of the given wallet, as currently known on the
    ///        Ethereum chain. If the wallet has no main UTXO, this parameter
    ///        can be empty as it is ignored since the wallet balance is
    ///        assumed to be zero.
    ///      - Wallet must be in Live state
    function notifyCloseableWallet(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata walletMainUtxo
    ) external {
        require(
            self.activeWalletPubKeyHash != walletPubKeyHash,
            "Active wallet cannot be considered closeable"
        );

        Wallet storage wallet = self.registeredWallets[walletPubKeyHash];
        require(
            wallet.state == WalletState.Live,
            "ECDSA wallet must be in Live state"
        );

        /* solhint-disable-next-line not-rely-on-time */
        bool walletOldEnough = block.timestamp >=
            wallet.createdAt + self.walletMaxAge;

        require(
            walletOldEnough ||
                getWalletBtcBalance(self, walletPubKeyHash, walletMainUtxo) <
                self.walletMinBtcBalance,
            "Wallet needs to be old enough or have too few satoshis"
        );

        moveFunds(self, walletPubKeyHash);
    }

    /// @notice Requests a wallet to move their funds. If the wallet balance
    ///         is zero, the wallet is closed immediately and the ECDSA
    ///         registry is notified about this fact. If the move funds
    ///         request refers to the current active wallet, such a wallet
    ///         is no longer considered active and the active wallet slot
    ///         is unset allowing to trigger a new wallet creation immediately.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @dev Requirements:
    ///      - The caller must make sure that the wallet is in the Live state
    function moveFunds(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash
    ) internal {
        Wallet storage wallet = self.registeredWallets[walletPubKeyHash];

        if (wallet.mainUtxoHash == bytes32(0)) {
            // If the wallet has no main UTXO, that means its BTC balance
            // is zero and it should be closed immediately.
            closeWallet(self, walletPubKeyHash);
        } else {
            // Otherwise, initialize the moving funds process.
            wallet.state = WalletState.MovingFunds;
            /* solhint-disable-next-line not-rely-on-time */
            wallet.movingFundsRequestedAt = uint32(block.timestamp);

            emit WalletMovingFunds(wallet.ecdsaWalletID, walletPubKeyHash);
        }

        if (self.activeWalletPubKeyHash == walletPubKeyHash) {
            // If the move funds request refers to the current active wallet,
            // unset the active wallet and make the wallet creation process
            // possible in order to get a new healthy active wallet.
            delete self.activeWalletPubKeyHash;
        }

        self.liveWalletsCount--;
    }

    /// @notice Closes the given wallet and notifies the ECDSA registry
    ///         about this fact.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @dev Requirements:
    ///      - The caller must make sure that the wallet is in the
    ///        Live or MovingFunds state.
    function closeWallet(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash
    ) internal {
        Wallet storage wallet = self.registeredWallets[walletPubKeyHash];

        wallet.state = WalletState.Closed;

        emit WalletClosed(wallet.ecdsaWalletID, walletPubKeyHash);

        self.ecdsaWalletRegistry.closeWallet(wallet.ecdsaWalletID);
    }

    /// @notice Reports about a fraud committed by the given wallet. This
    ///         function performs slashing and wallet termination in reaction
    ///         to a proven fraud and it should only be called when the fraud
    ///         was confirmed.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @dev Requirements:
    ///      - Wallet must be in Live or MovingFunds state
    ///
    // slither-disable-next-line dead-code
    function notifyWalletFraud(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash
    ) internal {
        WalletState walletState = self
            .registeredWallets[walletPubKeyHash]
            .state;

        require(
            walletState == WalletState.Live ||
                walletState == WalletState.MovingFunds,
            "ECDSA wallet must be in Live or MovingFunds state"
        );

        terminateWallet(self, walletPubKeyHash);

        // TODO: Perform slashing of wallet operators and add unit tests for that.
    }

    /// @notice Terminates the given wallet and notifies the ECDSA registry
    ///         about this fact. If the wallet termination refers to the current
    ///         active wallet, such a wallet is no longer considered active and
    ///         the active wallet slot is unset allowing to trigger a new wallet
    ///         creation immediately.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @dev Requirements:
    ///      - The caller must make sure that the wallet is in the
    ///        Live or MovingFunds state.
    ///
    // slither-disable-next-line dead-code
    function terminateWallet(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash
    ) internal {
        Wallet storage wallet = self.registeredWallets[walletPubKeyHash];

        if (wallet.state == WalletState.Live) {
            self.liveWalletsCount--;
        }

        wallet.state = WalletState.Terminated;

        emit WalletTerminated(wallet.ecdsaWalletID, walletPubKeyHash);

        if (self.activeWalletPubKeyHash == walletPubKeyHash) {
            // If termination refers to the current active wallet,
            // unset the active wallet and make the wallet creation process
            // possible in order to get a new healthy active wallet.
            delete self.activeWalletPubKeyHash;
        }

        self.ecdsaWalletRegistry.closeWallet(wallet.ecdsaWalletID);
    }

    /// @notice Notifies that the wallet completed the moving funds process
    ///         successfully. Checks if the funds were moved to the expected
    ///         target wallets. Closes the source wallet if everything went
    ///         good and reverts otherwise.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @param targetWalletsHash 32-byte keccak256 hash over the list of
    ///        20-byte public key hashes of the target wallets actually used
    ///        within the moving funds transactions.
    /// @dev Requirements:
    ///      - The caller must make sure the moving funds transaction actually
    ///        happened on Bitcoin chain and fits the protocol requirements.
    ///      - The source wallet must be in the MovingFunds state
    ///      - The target wallets commitment must be submitted by the source
    ///        wallet.
    ///      - The actual target wallets used in the moving funds transaction
    ///        must be exactly the same as the target wallets commitment.
    function notifyWalletFundsMoved(
        BridgeState.Storage storage self,
        bytes20 walletPubKeyHash,
        bytes32 targetWalletsHash
    ) internal {
        Wallet storage wallet = self.registeredWallets[walletPubKeyHash];
        // Check that the wallet is in the MovingFunds state but don't check
        // if the moving funds timeout is exceeded. That should give a
        // possibility to move funds in case when timeout was hit but was
        // not reported yet.
        require(
            wallet.state == WalletState.MovingFunds,
            "ECDSA wallet must be in MovingFunds state"
        );

        bytes32 targetWalletsCommitmentHash = wallet
            .movingFundsTargetWalletsCommitmentHash;

        require(
            targetWalletsCommitmentHash != bytes32(0),
            "Target wallets commitment not submitted yet"
        );

        // Make sure that the target wallets where funds were moved to are
        // exactly the same as the ones the source wallet committed to.
        require(
            targetWalletsCommitmentHash == targetWalletsHash,
            "Target wallets don't correspond to the commitment"
        );

        // If funds were moved, the wallet has no longer a main UTXO.
        delete wallet.mainUtxoHash;

        closeWallet(self, walletPubKeyHash);
    }
}
