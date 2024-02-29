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

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../integrator/IBridge.sol";
import "./Wormhole.sol";

// TODO: Document this interface.
interface IL2WormholeGateway {
    // TODO: Document this function.
    function receiveTbtc(bytes memory vaa) external;
}

// TODO: Document this contract.
contract L2BitcoinDepositor is IWormholeReceiver, OwnableUpgradeable {
    using BTCUtils for bytes;

    // TODO: Document state variables.
    IWormholeRelayer public wormholeRelayer;
    IL2WormholeGateway public l2WormholeGateway;
    uint16 public l2ChainId;
    uint16 public l1ChainId;
    address public l1BitcoinDepositor;
    uint256 public l1InitializeDepositGasLimit;

    event DepositInitialized(
        uint256 indexed depositKey,
        address indexed l2DepositOwner,
        address indexed l2Sender,
        uint64 wormholeMessageSequence
    );

    event L1InitializeDepositGasLimitUpdated(
        uint256 l1InitializeDepositGasLimit
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _wormholeRelayer,
        address _l2WormholeGateway,
        uint16 _l2ChainId,
        uint16 _l1ChainId,
        address _l1BitcoinDepositor
    ) external initializer {
        __Ownable_init();

        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        l2WormholeGateway = IL2WormholeGateway(_l2WormholeGateway);
        l2ChainId = _l2ChainId;
        l1ChainId = _l1ChainId;
        l1BitcoinDepositor = _l1BitcoinDepositor;
        l1InitializeDepositGasLimit = 200_000;
    }

    // TODO: Document this function.
    function updateL1InitializeDepositGasLimit(
        uint256 _l1InitializeDepositGasLimit
    ) external onlyOwner {
        l1InitializeDepositGasLimit = _l1InitializeDepositGasLimit;
        emit L1InitializeDepositGasLimitUpdated(_l1InitializeDepositGasLimit);
    }

    // TODO: Document this function.
    function initializeDeposit(
        IBridgeTypes.BitcoinTxInfo calldata fundingTx,
        IBridgeTypes.DepositRevealInfo calldata reveal,
        address l2DepositOwner
    ) external payable {
        require(
            l2DepositOwner != address(0),
            "L2 deposit owner must not be 0x0"
        );

        // Cost of requesting a `initializeDeposit` message to be sent to
        //  `l1ChainId` with a gasLimit of `l1InitializeDepositGasLimit`.
        uint256 cost = quoteInitializeDeposit();

        require(msg.value == cost, "Payment for Wormhole Relayer is too low");

        uint64 wormholeMessageSequence = wormholeRelayer.sendPayloadToEvm{
            value: cost
        }(
            l1ChainId,
            l1BitcoinDepositor,
            abi.encode(fundingTx, reveal, l2DepositOwner), // Message payload.
            0, // No receiver value needed.
            l1InitializeDepositGasLimit,
            l2ChainId, // Set this L2 chain as the refund chain.
            msg.sender // Set the caller as the refund receiver.
        );

        uint256 depositKey = uint256(
            keccak256(
                abi.encodePacked(
                    abi
                        .encodePacked(
                            fundingTx.version,
                            fundingTx.inputVector,
                            fundingTx.outputVector,
                            fundingTx.locktime
                        )
                        .hash256View(),
                    reveal.fundingOutputIndex
                )
            )
        );

        emit DepositInitialized(
            depositKey,
            l2DepositOwner,
            msg.sender,
            wormholeMessageSequence
        );
    }

    // TODO: Document this function.
    function quoteInitializeDeposit() public view returns (uint256 cost) {
        (cost, ) = wormholeRelayer.quoteEVMDeliveryPrice(
            l1ChainId,
            0, // No receiver value needed.
            l1InitializeDepositGasLimit
        );
    }

    // TODO: Document this function.
    function receiveWormholeMessages(
        bytes memory,
        bytes[] memory additionalVaas,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32
    ) external payable {
        require(
            msg.sender == address(wormholeRelayer),
            "Caller is not Wormhole Relayer"
        );

        require(
            sourceChain == l1ChainId,
            "Source chain is not the expected L1 chain"
        );

        require(
            WormholeUtils.fromWormholeAddress(sourceAddress) ==
                l1BitcoinDepositor,
            "Source address is not the expected L1 Bitcoin depositor"
        );

        require(
            additionalVaas.length == 1,
            "Expected 1 additional VAA key for token transfer"
        );

        finalizeDeposit(additionalVaas[0]);
    }

    // TODO: Document this function.
    function finalizeDeposit(bytes memory vaa) internal {
        l2WormholeGateway.receiveTbtc(vaa);
    }
}
