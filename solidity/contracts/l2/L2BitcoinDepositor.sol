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

import "../integrator/IBridge.sol";
import "./Wormhole.sol";

// TODO: Document this interface.
interface IL2WormholeGateway {
    // TODO: Document this function.
    function receiveTbtc(bytes memory vaa) external;
}

// TODO: Document this contract.
contract L2BitcoinDepositor is IWormholeReceiver, OwnableUpgradeable {
    // TODO: Document state variables.
    IWormholeRelayer public wormholeRelayer;
    IL2WormholeGateway public l2WormholeGateway;
    uint16 public l1ChainId;
    address public l1BitcoinDepositor;

    event DepositInitialized(
        IBridgeTypes.BitcoinTxInfo fundingTx,
        IBridgeTypes.DepositRevealInfo reveal,
        address indexed l2DepositOwner,
        address indexed l2Sender
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _wormholeRelayer,
        address _l2WormholeGateway,
        uint16 _l1ChainId
    ) external initializer {
        __Ownable_init();

        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        l2WormholeGateway = IL2WormholeGateway(_l2WormholeGateway);
        l1ChainId = _l1ChainId;
    }

    // TODO: Document this function.
    function attachL1BitcoinDepositor(address _l1BitcoinDepositor)
        external
        onlyOwner
    {
        require(
            l1BitcoinDepositor == address(0),
            "L1 Bitcoin Depositor already set"
        );
        require(
            _l1BitcoinDepositor != address(0),
            "L1 Bitcoin Depositor must not be 0x0"
        );
        l1BitcoinDepositor = _l1BitcoinDepositor;
    }

    // TODO: Document this function.
    function initializeDeposit(
        IBridgeTypes.BitcoinTxInfo calldata fundingTx,
        IBridgeTypes.DepositRevealInfo calldata reveal,
        address l2DepositOwner
    ) external {
        emit DepositInitialized(fundingTx, reveal, l2DepositOwner, msg.sender);
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

        l2WormholeGateway.receiveTbtc(additionalVaas[0]);
    }
}
