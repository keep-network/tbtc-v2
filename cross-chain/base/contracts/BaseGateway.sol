pragma solidity ^0.8.17;

import "./lib/wormhole-solidity-sdk/interfaces/IWormholeRelayer.sol";
// import BitcoinTx from tBTC
// import Deposit from tBTC

contract BaseGateway {
    uint256 constant GAS_LIMIT = 50_000; // TODO: check this value

    IWormholeRelayer public immutable wormholeRelayer;

    constructor(address _wormholeRelayer) {
        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
    }

    // targetChain: Ethereum with a chain ID 2
    // targetAddress: address of the Base Depositor contract on Ethereum
    function revealDeposit(
        uint16 targetChain, // Ethereum
        address targetAddress, // BaseDepositor
        BitcoinTx.Info calldata fundingTx,
        Deposit.DepositRevealInfo calldata reveal
    ) external {
        // Cost of requesting a message to be sent to
        // chain 'targetChain' with a gasLimit of 'GAS_LIMIT'
        uint256 cost = quoteCrossChainDelivery(targetChain);
        require(msg.value == cost);

        wormholeRelayer.sendPayloadToEvm{value: cost}(
            targetChain,
            targetAddress,
            abi.encode(fundingTx, reveal, msg.sender), // payload
            0, // no receiver value needed since we're just passing a message
            GAS_LIMIT
        );

        // emit revealDeposit(params...)
    }

    // targetChain: Ethereum with a chain ID 2
    // targetAddress: address of the Base Redemption contract on Ethereum
    function requestRedemption(
      uint16 targetChain, // Ethereum
      address targetAddress, // BaseRedeemer
      bytes20 walletPubKeyHash,
      BitcoinTx.UTXO calldata mainUtxo,
      bytes calldata redeemerOutputScript,
      uint64 amount
    ) external {
        // Relayer calls L2WormholeGateway.sendTBTC to send the canonical TBTC to the redeemer from L2 -> L1

        // Cost of requesting a message to be sent to
        // chain 'targetChain' with a gasLimit of 'GAS_LIMIT'
        uint256 cost = quoteCrossChainDelivery(targetChain);
        require(msg.value == cost);

        wormholeRelayer.sendPayloadToEvm{value: cost}(
            targetChain,
            targetAddress,
            abi.encode(walletPubKeyHash, mainUtxo, redeemerOutputScript, amount, msg.sender), // payload
            0, // no receiver value needed since we're just passing a message
            GAS_LIMIT
        );

        // emit request redemption event
    }

    function quoteCrossChainDelivery(uint16 targetChain) public view returns (uint256 cost) {
        (cost,) = wormholeRelayer.quoteEVMDeliveryPrice(targetChain, 0, GAS_LIMIT);
    }
}
