// SPDX-License-Identifier: GPL-3.0-only

// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌

pragma solidity 0.8.17;

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";

import "./BitcoinTx.sol";
import "./Bridge.sol";
import "./Deposit.sol";
import "./../vault/TBTCVault.sol";
import "./../vault/TBTCOptimisticMinting.sol";
import "./../token/TBTC.sol";

// TODO: Make it safe for upgradeable contracts.
// TODO: Document the contract.
// TODO: Move to another directory?
abstract contract DepositorProxy {
    using BTCUtils for bytes;

    /// @notice Multiplier to convert satoshi to TBTC token units.
    uint256 public constant SATOSHI_MULTIPLIER = 10**10;

    Bridge public bridge;
    TBTCVault public tbtcVault;
    TBTC public tbtcToken;

    mapping(uint256 => bool) public pendingDeposits;

    event DepositInitialized(
        uint256 indexed depositKey,
        uint32 initiatedAt
    );

    event DepositFinalized(
        uint256 indexed depositKey,
        uint256 tbtcAmount,
        uint32 finalizedAt
    );

    constructor(address _bridge, address _tbtcVault, address _tbtcToken) {
        bridge = Bridge(_bridge);
        tbtcVault = TBTCVault(_tbtcVault);
        tbtcToken = TBTC(_tbtcToken);
    }

    function initializeDeposit(
        BitcoinTx.Info calldata fundingTx,
        Deposit.DepositRevealInfo calldata reveal,
        bytes32 extraData
    ) internal {
        require(reveal.vault == address(tbtcVault), "Vault address mismatch");

        uint256 depositKey = calculateDepositKey(
            calculateBitcoinTxHash(fundingTx),
            reveal.fundingOutputIndex
        );

        pendingDeposits[depositKey] = true;

        emit DepositInitialized(
            depositKey,
            /* solhint-disable-next-line not-rely-on-time */
            uint32(block.timestamp)
        );

        // The Bridge does not allow to reveal the same deposit twice and
        // revealed deposits stay there forever. The transaction will revert
        // if the deposit has already been revealed so, there is no need to do
        // an explicit check here.
        bridge.revealDepositWithExtraData(fundingTx, reveal, extraData);
    }

    function finalizeDeposit(uint256 depositKey) internal {
        require(pendingDeposits[depositKey], "Deposit not initialized");

        Deposit.DepositRequest memory deposit = bridge.deposits(depositKey);

        bool minted = deposit.sweptAt != 0 ||
            tbtcVault.optimisticMintingRequests(depositKey).finalizedAt != 0;

        require(minted, "Deposit not finalized by the bridge");

        // We can safely delete the deposit from the pending deposits mapping.
        // This deposit cannot be initialized again because the bridge does not
        // allow to reveal the same deposit twice.
        delete pendingDeposits[depositKey];

        // Both deposit amount and treasury fee are in the 1e8 satoshi precision.
        // We need to convert them to the 1e18 TBTC precision.
        uint256 amountSubTreasury = (deposit.amount - deposit.treasuryFee) *
                    SATOSHI_MULTIPLIER;

        uint256 omFeeDivisor = tbtcVault.optimisticMintingFeeDivisor();
        uint256 omFee = omFeeDivisor > 0 ? (amountSubTreasury / omFeeDivisor) : 0;

        // The deposit transaction max fee is in the 1e8 satoshi precision.
        // We need to convert them to the 1e18 TBTC precision.
        (,,uint64 depositTxMaxFee,) = bridge.depositParameters();
        uint256 txMaxFee = depositTxMaxFee * SATOSHI_MULTIPLIER;

        uint256 tbtcAmount = amountSubTreasury - omFee - txMaxFee;

        emit DepositFinalized(
            depositKey,
            tbtcAmount,
            /* solhint-disable-next-line not-rely-on-time */
            uint32(block.timestamp)
        );

        onDepositFinalized(depositKey, tbtcAmount, deposit.extraData);
    }

    function onDepositFinalized(
        uint256 depositKey,
        uint256 tbtcAmount,
        bytes32 extraData
    ) internal virtual;

    function calculateDepositKey(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex
    ) internal pure returns (uint256) {
        return uint256(
            keccak256(abi.encodePacked(fundingTxHash, fundingOutputIndex))
        );
    }

    function calculateBitcoinTxHash(
        BitcoinTx.Info calldata txInfo
    ) internal pure returns (bytes32) {
        return abi.encodePacked(
            txInfo.version,
            txInfo.inputVector,
            txInfo.outputVector,
            txInfo.locktime
        ).hash256View();
    }
}