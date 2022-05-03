// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../bridge/BitcoinTx.sol";
import "../bridge/Bridge.sol";
import "../bridge/MovingFunds.sol";
import "../bridge/Wallets.sol";

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

    function setMovedFundsMergeRequest(
        bytes20 walletPubKeyHash,
        BitcoinTx.UTXO calldata utxo
    ) external {
        uint256 requestKey = uint256(
            keccak256(abi.encodePacked(utxo.txHash, utxo.txOutputIndex))
        );

        self.movedFundsMergeRequests[requestKey] = MovingFunds
            .MovedFundsMergeRequest(
                walletPubKeyHash,
                utxo.txOutputValue,
                /* solhint-disable-next-line not-rely-on-time */
                uint32(block.timestamp),
                0
            );
    }
}
