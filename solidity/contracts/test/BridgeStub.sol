// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../bridge/BitcoinTx.sol";
import "../bridge/Bridge.sol";

contract BridgeStub is Bridge {
    constructor(
        address _bank,
        address _relay,
        address _treasury,
        uint256 _txProofDifficultyFactor
    ) Bridge(_bank, _relay, _treasury, _txProofDifficultyFactor) {}

    function setMainUtxo(bytes20 walletPubKeyHash, BitcoinTx.UTXO calldata utxo)
        external
    {
        mainUtxos[walletPubKeyHash] = keccak256(
            abi.encodePacked(
                utxo.txHash,
                utxo.txOutputIndex,
                utxo.txOutputValue
            )
        );
    }

    function setWallet(bytes20 walletPubKeyHash, Wallet calldata wallet)
        external
    {
        wallets[walletPubKeyHash] = wallet;
    }
}
