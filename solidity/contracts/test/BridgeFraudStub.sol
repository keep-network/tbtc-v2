// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./BridgeStub.sol";
import "../bridge/BitcoinTx.sol";
import "../bridge/MovingFunds.sol";
import "../bridge/Wallets.sol";

contract BridgeFraudStub is BridgeStub {
    function setSweptDeposits(BitcoinTx.UTXO[] calldata utxos) external {
        for (uint256 i = 0; i < utxos.length; i++) {
            uint256 utxoKey = uint256(
                keccak256(
                    abi.encodePacked(utxos[i].txHash, utxos[i].txOutputIndex)
                )
            );
            self.deposits[utxoKey].sweptAt = 1641650400;
        }
    }

    function setSpentMainUtxos(BitcoinTx.UTXO[] calldata utxos) external {
        for (uint256 i = 0; i < utxos.length; i++) {
            uint256 utxoKey = uint256(
                keccak256(
                    abi.encodePacked(utxos[i].txHash, utxos[i].txOutputIndex)
                )
            );
            self.spentMainUTXOs[utxoKey] = true;
        }
    }

    function setProcessedMovedFundsSweepRequests(
        BitcoinTx.UTXO[] calldata utxos
    ) external {
        for (uint256 i = 0; i < utxos.length; i++) {
            uint256 utxoKey = uint256(
                keccak256(
                    abi.encodePacked(utxos[i].txHash, utxos[i].txOutputIndex)
                )
            );
            self.movedFundsSweepRequests[utxoKey].state = MovingFunds
                .MovedFundsSweepRequestState
                .Processed;
        }
    }
}
