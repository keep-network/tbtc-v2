pragma solidity ^0.8.17;

import "./lib/wormhole-solidity-sdk/interfaces/IWormholeRelayer.sol";
import "./lib/wormhole-solidity-sdk/interfaces/IWormholeReceiver.sol";
import "../bridge/Bridge.sol";
import "../bridge/Deposit.sol";
import "../bridge/BitcoinTx.sol";

// BaseDepositor is a contract that receives Wormhole VAAs from a BaseGateway on L2
// and reveals Bitcoin deposit to the tBTC Bridge contract.
contract BaseDepositor is IWormholeReceiver {
    IWormholeRelayer public immutable wormholeRelayer;
    Bridge public immutable bridge;

    mapping(bytes32 => bool) public seenDeliveryVaaHashes;

    constructor(address _wormholeRelayer, Bridge _bridge) {
        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        bridge = _bridge;
    }

    // Receive Wormhole VAAs from a L2 Base and reveal Bitcoin deposit to
    // the tBTC Bridge contract.
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory, // additionalVaas
        bytes32, // address that called 'sendPayloadToEvm' (BaseGateway contract address)
        uint16 sourceChain,
        bytes32 deliveryHash
    ) public payable override {
        require(msg.sender == address(wormholeRelayer), "Only relayer allowed");

        // Ensure no duplicate deliveries
        require(!seenDeliveryVaaHashes[deliveryHash], "Message already processed");
        seenDeliveryVaaHashes[deliveryHash] = true;

        // Parse the received payload
        BitcoinTx.UTXO memory fundingTx = abi.decode(payload[:32], (BitcoinTx.UTXO));
        Deposit.DepositRevealInfo memory reveal = abi.decode(payload[32:], (Deposit.DepositRevealInfo));

        // emit RevealDepositReceived(params...);

        // Call the tBTC Bridge contract to reveal the deposit
        // bridge.revealDeposit(fundingTx, reveal);
    }
}