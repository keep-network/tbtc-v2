// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../bridge/BitcoinTx.sol";
import "../bridge/Bridge.sol";
import "../bridge/Wallets.sol";

contract BridgeStub is Bridge {
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

    function setActiveWallet(bytes20 activeWalletPubKeyHash) external {
        self.activeWalletPubKeyHash = activeWalletPubKeyHash;
    }

    function setWalletMainUtxo(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata utxo
    ) external {
        self.registeredWallets[walletPubKeyHash].mainUtxoHash = keccak256(
            abi.encodePacked(
                utxo.txHash,
                utxo.txOutputIndex,
                utxo.txOutputValue
            )
        );
    }

    function unsetWalletMainUtxo(bytes20 walletPubKeyHash) external {
        delete self.registeredWallets[walletPubKeyHash].mainUtxoHash;
    }

    function setWallet(bytes20 walletPubKeyHash, Wallets.Wallet calldata wallet)
        external
    {
        self.registeredWallets[walletPubKeyHash] = wallet;

        if (wallet.state == Wallets.WalletState.Live) {
            self.liveWalletsCount++;
        }
    }

    function setDepositDustThreshold(uint64 _depositDustThreshold) external {
        self.depositDustThreshold = _depositDustThreshold;
    }

    function setDepositTxMaxFee(uint64 _depositTxMaxFee) external {
        self.depositTxMaxFee = _depositTxMaxFee;
    }

    function setRedemptionDustThreshold(uint64 _redemptionDustThreshold)
        external
    {
        self.redemptionDustThreshold = _redemptionDustThreshold;
    }

    function setRedemptionTreasuryFeeDivisor(
        uint64 _redemptionTreasuryFeeDivisor
    ) external {
        self.redemptionTreasuryFeeDivisor = _redemptionTreasuryFeeDivisor;
    }

    function setMovingFundsTxMaxTotalFee(uint64 _movingFundsTxMaxTotalFee)
        external
    {
        self.movingFundsTxMaxTotalFee = _movingFundsTxMaxTotalFee;
    }
}
