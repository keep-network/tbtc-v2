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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../integrator/AbstractTBTCDepositor.sol";
import "../integrator/IBridge.sol";

/// @title IWormholeReceiver
/// @notice Wormhole Receiver interface. Contains only selected functions
///         used by L1BitcoinDepositor.
/// @dev See: https://github.com/wormhole-foundation/wormhole-solidity-sdk/blob/2b7db51f99b49eda99b44f4a044e751cb0b2e8ea/src/interfaces/IWormholeReceiver.sol#L8
interface IWormholeReceiver {
    /// @dev See: https://github.com/wormhole-foundation/wormhole-solidity-sdk/blob/2b7db51f99b49eda99b44f4a044e751cb0b2e8ea/src/interfaces/IWormholeReceiver.sol#L44
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory additionalMessages,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 deliveryHash
    ) external payable;
}

// TODO: Document this contract.
contract L1BitcoinDepositor is
    AbstractTBTCDepositor,
    IWormholeReceiver,
    OwnableUpgradeable
{
    /// @notice Reflects the deposit state:
    ///         - Unknown deposit has not been initialized yet.
    ///         - Initialized deposit has been initialized with a call to
    ///           `initializeDeposit` function and is known to this contract.
    ///         - Finalized deposit led to tBTC ERC20 minting and was finalized
    ///           with a call to `finalizeDeposit` function that deposited tBTC
    ///           to the Portal contract.
    enum DepositState {
        Unknown,
        Initialized,
        Finalized
    }

    /// @notice Holds the deposit state, keyed by the deposit key calculated for
    ///         the individual deposit during the call to `initializeDeposit`
    ///         function.
    mapping(uint256 => DepositState) public deposits;

    // TODO: Document other state variables.
    address public wormholeRelayer;
    address public wormholeTokenBridge;
    uint16 public l2ChainId;
    address public l2BitcoinDepositor;

    event DepositInitialized(
        uint256 indexed depositKey,
        address indexed l2DepositOwner,
        address indexed l1Sender
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _tbtcBridge,
        address _tbtcVault,
        address _wormholeRelayer,
        address _wormholeTokenBridge,
        uint16 _l2ChainId,
        address _l2BitcoinDepositor
    ) external initializer {
        __AbstractTBTCDepositor_initialize(_tbtcBridge, _tbtcVault);
        __Ownable_init();

        wormholeRelayer = _wormholeRelayer;
        wormholeTokenBridge = _wormholeTokenBridge;
        l2ChainId = _l2ChainId;
        l2BitcoinDepositor = _l2BitcoinDepositor;
    }

    // TODO: Document this function.
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32
    ) external payable {
        require(
            msg.sender == address(wormholeRelayer),
            "Caller is not Wormhole Relayer"
        );

        require(
            sourceChain == l2ChainId,
            "Source chain is not the expected L2 chain"
        );

        require(
            fromWormholeAddress(sourceAddress) == l2BitcoinDepositor,
            "Source address is not the expected L2 Bitcoin depositor"
        );

        (
            IBridgeTypes.BitcoinTxInfo memory fundingTx,
            IBridgeTypes.DepositRevealInfo memory reveal,
            address l2DepositOwner
        ) = abi.decode(
                payload,
                (
                    IBridgeTypes.BitcoinTxInfo,
                    IBridgeTypes.DepositRevealInfo,
                    address
                )
            );

        initializeDeposit(fundingTx, reveal, l2DepositOwner);
    }

    // TODO: Document this function.
    function initializeDeposit(
        IBridgeTypes.BitcoinTxInfo memory fundingTx,
        IBridgeTypes.DepositRevealInfo memory reveal,
        address l2DepositOwner
    ) public {
        require(
            l2DepositOwner != address(0),
            "L2 deposit owner must not be 0x0"
        );

        // TODO: Document how the Bridge works and why we don't need to validate input parameters.
        (uint256 depositKey, ) = _initializeDeposit(
            fundingTx,
            reveal,
            toWormholeAddress(l2DepositOwner)
        );

        require(
            deposits[depositKey] == DepositState.Unknown,
            "Wrong deposit state"
        );

        deposits[depositKey] = DepositState.Initialized;

        emit DepositInitialized(depositKey, l2DepositOwner, msg.sender);
    }

    /// @notice Converts Ethereum address into Wormhole format.
    /// @param _address The address to convert.
    function toWormholeAddress(address _address)
        internal
        pure
        returns (bytes32)
    {
        return bytes32(uint256(uint160(_address)));
    }

    /// @notice Converts Wormhole address into Ethereum format.
    /// @param _address The address to convert.
    function fromWormholeAddress(bytes32 _address)
        internal
        pure
        returns (address)
    {
        return address(uint160(uint256(_address)));
    }
}
