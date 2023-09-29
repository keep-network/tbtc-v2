pragma solidity ^0.8.17;

import "./lib/wormhole-solidity-sdk/interfaces/IWormholeRelayer.sol";
import "./lib/wormhole-solidity-sdk/interfaces/IWormholeReceiver.sol";
import "../bridge/Bridge.sol";
import "../bridge/Deposit.sol";
import "../bridge/BitcoinTx.sol";

// BaseRedeemer is a contract that receives Wormhole VAAs from a BaseGateway on L2
// and requests a Bitcoin redemption.
contract BaseRedeemer is IWormholeReceiver {
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
        // (
        //  bytes20 walletPubKeyHash, 
        //  BitcoinTx.UTXO calldata fundingTx, 
        //  bytes calldata redeemerOutputScript, 
        //  uint64 amount
        // ) = abi.decode(payload, (bytes20, BitcoinTx.UTXO, bytes, uint64));
        // emit RequestRedemptionReceived(params...);

        // Call the tBTC Bridge contract to request redemption
        // Watch out for the msg.sender. Here it's a relayer, not the user who requested redemption.
        // See Bridge.requestRedemption() for more details.

        // bridge.requestRedemption(walletPubKeyHash, mainUtxo, redeemerOutputScript, amount);
    }
}