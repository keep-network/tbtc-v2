// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../bridge/BitcoinTx.sol";
import "../bridge/Bridge.sol";
import "../bridge/Wallets.sol";

// TODO: Try to create a separate BridgeStub for every test group (wallets,
//       frauds, etc.) to decrease the size.
contract BridgeStub is Bridge {
    constructor(
        address _bank,
        address _relay,
        address _treasury,
        address _walletRegistry,
        uint256 _txProofDifficultyFactor
    )
        Bridge(
            _bank,
            _relay,
            _treasury,
            _walletRegistry,
            _txProofDifficultyFactor
        )
    {}

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
            spentMainUTXOs[utxoKey] = true;
        }
    }

    function setActiveWallet(bytes20 activeWalletPubKeyHash) external {
        wallets.activeWalletPubKeyHash = activeWalletPubKeyHash;
    }

    function setWalletMainUtxo(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata utxo
    ) external {
        wallets.registeredWallets[walletPubKeyHash].mainUtxoHash = keccak256(
            abi.encodePacked(
                utxo.txHash,
                utxo.txOutputIndex,
                utxo.txOutputValue
            )
        );
    }

    function unsetWalletMainUtxo(bytes20 walletPubKeyHash) external {
        delete wallets.registeredWallets[walletPubKeyHash].mainUtxoHash;
    }

    function setWallet(bytes20 walletPubKeyHash, Wallets.Wallet calldata wallet)
        external
    {
        wallets.registeredWallets[walletPubKeyHash] = wallet;
    }

    function setDepositDustThreshold(uint64 _depositDustThreshold) external {
        self.depositDustThreshold = _depositDustThreshold;
    }

    function setDepositTxMaxFee(uint64 _depositTxMaxFee) external {
        depositTxMaxFee = _depositTxMaxFee;
    }

    function setRedemptionDustThreshold(uint64 _redemptionDustThreshold)
        external
    {
        redemptionDustThreshold = _redemptionDustThreshold;
    }

    function setRedemptionTreasuryFeeDivisor(
        uint64 _redemptionTreasuryFeeDivisor
    ) external {
        redemptionTreasuryFeeDivisor = _redemptionTreasuryFeeDivisor;
    }

    function setMovingFundsTxMaxTotalFee(uint64 _movingFundsTxMaxTotalFee)
        external
    {
        movingFundsTxMaxTotalFee = _movingFundsTxMaxTotalFee;
    }
}
