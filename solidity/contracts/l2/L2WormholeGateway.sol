// SPDX-License-Identifier: GPL-3.0-only

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

pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "./L2TBTC.sol";

/// @title IWormholeTokenBridge
/// @notice Wormhole Token Bridge interface. Contains only selected functions
///         used by L2WormholeGateway.
interface IWormholeTokenBridge {
    function completeTransferWithPayload(bytes memory encodedVm)
        external
        returns (bytes memory);

    function parseTransferWithPayload(bytes memory encoded)
        external
        pure
        returns (TransferWithPayload memory transfer);

    function transferTokens(
        address token,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    ) external payable returns (uint64 sequence);

    struct TransferWithPayload {
        uint8 payloadID;
        uint256 amount;
        bytes32 tokenAddress;
        uint16 tokenChain;
        bytes32 to;
        uint16 toChain;
        bytes32 fromAddress;
        bytes payload;
    }
}

/// @title L2WormholeGateway
/// @notice Selected cross-ecosystem bridges are given the minting authority for
///         tBTC token on L2 and sidechains. This contract gives a minting
///         authority to the Wormhole Bridge.
///
///         The process of bridging from L1 to L2 (or sidechain) looks as
///         follows:
///         1. There is a tBTC holder on L1. The holder goes to the Wormhole
///            Portal and selects the chain they want to bridge to.
///         2. The holder submits one transaction to L1 locking their tBTC
///            tokens in the bridge’s smart contract. After the transaction is
///            mined, they wait about 15 minutes for the Ethereum block
///            finality.
///         3. The holder submits one transaction to L2 that is minting tokens.
///            After that transaction is mined, they have their tBTC on L2.
///
///         The process of bridging from L2 (or sidechain) to L1 looks as
///         follows:
///         1. There is a tBTC holder on L2. That holder goes to the Wormhole
///            Portal and selects one of the L2 chains they want to bridge from.
///         2. The holder submits one transaction to L2 that is burning the
///            token. After the transaction is mined, they wait about 15 minutes
///            for the L2 block finality.
///         3. The holder submits one transaction to L1 unlocking their tBTC
///            tokens from the bridge’s smart contract. After that transaction
///            is mined, they have their tBTC on L1.
///
///         This smart contract is integrated with step 3 of L1->L2 bridging and
///         step 1 of L2->L1 or L2->L2 bridging. When the user redeems token on
///         L2, this contract receives the Wormhole tBTC representation and
///         mints the canonical tBTC in an equal amount. When user sends their
///         token from L1, this contract burns the canonical tBTC and sends
///         Wormhole tBTC representation through the bridge in an equal amount.
/// @dev This contract is supposed to be deployed behind a transparent
///      upgradeable proxy.
contract L2WormholeGateway is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Reference to the Wormhole Token Bridge contract.
    IWormholeTokenBridge public bridge;

    /// @notice Wormhole tBTC token representation.
    IERC20Upgradeable public bridgeToken;

    /// @notice Canonical tBTC token.
    L2TBTC public tbtc;

    /// @notice Minting limit for this gateway. Useful for early days of testing
    ///         the system. The gateway can not mint more canonical tBTC than
    ///         this limit.
    uint256 public mintingLimit;

    /// @notice The amount of tBTC minted by this contract. tBTC burned by this
    ///         contract decreases this amount.
    uint256 public mintedAmount;

    event WormholeTbtcReceived(address receiver, uint256 amount);

    event WormholeTbtcSent(
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    );

    event MintingLimitUpdated(uint256 mintingLimit);

    function initialize(
        IWormholeTokenBridge _bridge,
        IERC20Upgradeable _bridgeToken,
        L2TBTC _tbtc
    ) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        require(
            address(_bridge) != address(0),
            "Wormhole bridge address must not be 0x0"
        );
        require(
            address(_bridgeToken) != address(0),
            "Bridge token address must not be 0x0"
        );
        require(
            address(_tbtc) != address(0),
            "L2TBTC token address must not be 0x0"
        );

        bridge = _bridge;
        bridgeToken = _bridgeToken;
        tbtc = _tbtc;
        mintingLimit = type(uint256).max;
    }

    /// @notice This function is called when the user redeems their token on L2.
    ///         The contract receives Wormhole tBTC representation and mints the
    ///         canonical tBTC for the user.
    ///         If the tBTC minting limit has been reached by this contract,
    ///         instead of minting tBTC the receiver address receives Wormhole
    ///         tBTC representation.
    /// @dev Requirements:
    ///      - The receiver of Wormhole tBTC should be the L2WormholeGateway
    ///        contract.
    ///      - The receiver of the canonical tBTC should be abi-encoded in the
    ///        payload.
    ///      - The receiver of the canonical tBTC must not be the zero address.
    /// @param encodedVm A byte array containing a Wormhole VAA signed by the
    ///        guardians.
    function receiveWormhole(bytes memory encodedVm) external nonReentrant {
        // ITokenBridge.completeTransferWithPayload completes a contract-controlled
        // transfer of an ERC20 token. Calling this function is not enough to
        // ensure L2WormholeGateway received Wormhole tBTC representation.
        // Instead of going too deep into the ITokenBridge implementation,
        // asserting who is the receiver of the token, and which token it is,
        // we check the balance before the ITokenBridge call and the balance
        // after ITokenBridge call. This way, we are sure this contract received
        // Wormhole tBTC token in the given amount. This is transparent to
        // all potential upgrades of ITokenBridge implementation and no other
        // validations are needed.
        uint256 balanceBefore = bridgeToken.balanceOf(address(this));
        bytes memory encoded = bridge.completeTransferWithPayload(encodedVm);
        uint256 balanceAfter = bridgeToken.balanceOf(address(this));

        uint256 amount = balanceAfter - balanceBefore;
        address receiver = abi.decode(
            bridge.parseTransferWithPayload(encoded).payload,
            (address)
        );
        require(receiver != address(0), "0x0 receiver not allowed");

        // We send wormhole tBTC OR mint canonical tBTC. We do not want to send
        // dust. Sending wormhole tBTC is an exceptional situation and we want
        // to keep it simple.
        if (mintedAmount + amount > mintingLimit) {
            bridgeToken.safeTransfer(receiver, amount);
        } else {
            // Function is nonReentrant and we need to update the balance with
            // a call to completeTransferWithPayload first to know the amount.
            // slither-disable-next-line reentrancy-benign
            mintedAmount += amount;
            tbtc.mint(receiver, amount);
        }

        // Function is nonReentrant and we need to extract the payload with
        // a call to completeTransferWithPayload first.
        // slither-disable-next-line reentrancy-events
        emit WormholeTbtcReceived(receiver, amount);
    }

    /// @notice This function is called when the user sends their token from L2.
    ///         The contract burns the canonical tBTC from the user and sends
    ///         wormhole tBTC representation over the bridge.
    ///         Keep in mind that when multiple bridges receive a minting
    ///         authority on the canonical tBTC, this function may not be able
    ///         to send all amounts of tBTC through the Wormhole bridge. The
    ///         capability of Wormhole Bridge to send tBTC from the chain is
    ///         limited to the amount of tBTC bridged through Wormhole to that
    ///         chain.
    /// @dev Requirements:
    ///      - The sender must have at least `amount` of the canonical tBTC and
    ///        it has to be approved for L2WormholeGateway.
    ///      - The L2WormholeGateway must have at least `amount` of the wormhole
    ///        tBTC.
    /// @param amount The amount of tBTC to be sent.
    /// @param recipientChain The Wormhole recipient chain ID.
    /// @param recipient The address of the recipient in the Wormhole format.
    /// @param arbiterFee The Wormhole arbiter fee.
    /// @param nonce The Wormhole nonce used to batch messages together.
    /// @return The Wormhole sequence number.
    function sendWormhole(
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    ) external nonReentrant returns (uint64) {
        require(
            bridgeToken.balanceOf(address(this)) >= amount,
            "Not enough liquidity in wormhole to bridge"
        );

        emit WormholeTbtcSent(
            amount,
            recipientChain,
            recipient,
            arbiterFee,
            nonce
        );

        mintedAmount -= amount;
        tbtc.burnFrom(msg.sender, amount);

        bridgeToken.safeApprove(address(bridge), amount);
        return
            bridge.transferTokens(
                address(bridgeToken),
                amount,
                recipientChain,
                recipient,
                arbiterFee,
                nonce
            );
    }

    /// @notice Lets the governance to update the tBTC minting limit for this
    ///         contract.
    /// @param _mintingLimit The new minting limit.
    function updateMintingLimit(uint256 _mintingLimit) external onlyOwner {
        mintingLimit = _mintingLimit;
        emit MintingLimitUpdated(_mintingLimit);
    }
}
