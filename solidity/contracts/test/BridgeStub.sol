// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../bridge/BitcoinTx.sol";
import "../bridge/Bridge.sol";

contract BridgeStub is Bridge {
    struct Outpoint {
        bytes32 fundingTxHash;
        uint32 fundingOutputIndex;
    }

    constructor(
        address _bank,
        address _relay,
        address _treasury,
        uint256 _txProofDifficultyFactor
    ) Bridge(_bank, _relay, _treasury, _txProofDifficultyFactor) {}

    function setSweptDeposits(Outpoint[] calldata outpoints) external {
        for (uint256 i = 0; i < outpoints.length; i++) {
            uint256 utxoKey = uint256(
                keccak256(
                    abi.encodePacked(
                        outpoints[i].fundingTxHash,
                        outpoints[i].fundingOutputIndex
                    )
                )
            );

            deposits[utxoKey].sweptAt = 1641650400;
        }
    }

    function setSpentMainUtxos(Outpoint[] calldata outpoints) external {
        for (uint256 i = 0; i < outpoints.length; i++) {
            uint256 utxoKey = uint256(
                keccak256(
                    abi.encodePacked(
                        outpoints[i].fundingTxHash,
                        outpoints[i].fundingOutputIndex
                    )
                )
            );

            spentMainUTXOs[utxoKey] = true;
        }
    }

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

    function setDepositDustThreshold(uint64 _depositDustThreshold) external {
        depositDustThreshold = _depositDustThreshold;
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

    // TODO: Temporary function used for test purposes. Should be removed
    //       once real `notifyRedemptionTimeout` is implemented.
    function notifyRedemptionTimeout(
        bytes20 walletPubKeyHash,
        bytes calldata redeemerOutputScript
    ) external {
        uint256 redemptionKey = uint256(
            keccak256(abi.encodePacked(walletPubKeyHash, redeemerOutputScript))
        );
        RedemptionRequest storage request = pendingRedemptions[redemptionKey];

        require(request.requestedAt != 0, "Request does not exist");
        require(
            /* solhint-disable-next-line not-rely-on-time */
            request.requestedAt + redemptionTimeout < block.timestamp,
            "Request not timed out"
        );

        timedOutRedemptions[redemptionKey] = request;
        delete pendingRedemptions[redemptionKey];

        wallets[walletPubKeyHash].state = WalletState.MovingFunds;
        wallets[walletPubKeyHash].pendingRedemptionsValue -=
            request.requestedAmount -
            request.treasuryFee;
    }
}
