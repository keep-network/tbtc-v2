// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../bridge/BitcoinTx.sol";
import "../bridge/Bridge.sol";

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
