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

pragma solidity ^0.8.0;

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";

import "./IBridge.sol";
import "./ITBTCVault.sol";

/// @title Abstract AbstractTBTCDepositor contract.
/// @notice This abstract contract is meant to facilitate integration of protocols
///         aiming to use tBTC as an underlying Bitcoin bridge.
///
///         Such an integrator is supposed to:
///         - Create a child contract inheriting from this abstract contract
///         - Call the `__AbstractTBTCDepositor_initialize` initializer function
///         - Use the `_initializeDeposit` and `_finalizeDeposit` as part of their
///           business logic in order to initialize and finalize deposits.
///
/// @dev Example usage:
///      ```
///      // Example upgradeable integrator contract.
///      contract ExampleTBTCIntegrator is AbstractTBTCDepositor, Initializable {
///          /// @custom:oz-upgrades-unsafe-allow constructor
///          constructor() {
///              // Prevents the contract from being initialized again.
///              _disableInitializers();
///          }
///
///          function initialize(
///              address _bridge,
///              address _tbtcVault
///          ) external initializer {
///              __AbstractTBTCDepositor_initialize(_bridge, _tbtcVault);
///          }
///
///          function startProcess(
///              IBridgeTypes.BitcoinTxInfo calldata fundingTx,
///              IBridgeTypes.DepositRevealInfo calldata reveal
///          ) external {
///              // Embed necessary context as extra data.
///              bytes32 extraData = ...;
///
///              uint256 depositKey = _initializeDeposit(
///                  fundingTx,
///                  reveal,
///                  extraData
///              );
///
///              // Use the depositKey to track the process.
///          }
///
///          function finalizeProcess(uint256 depositKey) external {
///              (uint256 tbtcAmount, bytes32 extraData) = _finalizeDeposit(depositKey);
///
///              // Do something with the minted TBTC using context
///              // embedded in the extraData.
///          }
///      }
abstract contract AbstractTBTCDepositor {
    using BTCUtils for bytes;

    /// @notice Multiplier to convert satoshi to TBTC token units.
    uint256 public constant SATOSHI_MULTIPLIER = 10**10;

    /// @notice Bridge contract address.
    IBridge public bridge;
    /// @notice TBTCVault contract address.
    ITBTCVault public tbtcVault;
    /// @notice Mapping holding information about pending deposits that have
    ///         been initialized but not finalized yet. If the deposit is not
    ///         in this mapping it means it has already been finalized or it
    ///         has not been initialized yet.
    mapping(uint256 => bool) public pendingDeposits;

    // Reserved storage space that allows adding more variables without affecting
    // the storage layout of the child contracts. The convention from OpenZeppelin
    // suggests the storage space should add up to 50 slots. If more variables are
    // added in the upcoming versions one need to reduce the array size accordingly.
    // See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    // slither-disable-next-line unused-state
    uint256[47] private __gap;

    event DepositInitialized(uint256 indexed depositKey, uint32 initializedAt);

    event DepositFinalized(
        uint256 indexed depositKey,
        uint256 tbtcAmount,
        uint32 finalizedAt
    );

    /// @notice Initializes the contract. MUST BE CALLED from the child
    ///         contract initializer.
    // slither-disable-next-line dead-code
    function __AbstractTBTCDepositor_initialize(
        address _bridge,
        address _tbtcVault
    ) internal {
        require(
            address(bridge) == address(0) && address(tbtcVault) == address(0),
            "AbstractTBTCDepositor already initialized"
        );

        require(_bridge != address(0), "Bridge address cannot be zero");
        require(_tbtcVault != address(0), "TBTCVault address cannot be zero");

        bridge = IBridge(_bridge);
        tbtcVault = ITBTCVault(_tbtcVault);
    }

    /// @notice Initializes a deposit by revealing it to the Bridge.
    /// @param fundingTx Bitcoin funding transaction data, see `IBridgeTypes.BitcoinTxInfo`.
    /// @param reveal Deposit reveal data, see `IBridgeTypes.DepositRevealInfo` struct.
    /// @param extraData 32-byte deposit extra data.
    /// @return depositKey Deposit key computed as
    ///         `keccak256(fundingTxHash | reveal.fundingOutputIndex)`. This
    ///         key can be used to refer to the deposit in the Bridge and
    ///         TBTCVault contracts.
    /// @dev Requirements:
    ///      - The revealed vault address must match the TBTCVault address,
    ///      - All requirements from {Bridge#revealDepositWithExtraData}
    ///        function must be met.
    // slither-disable-next-line dead-code
    function _initializeDeposit(
        IBridgeTypes.BitcoinTxInfo calldata fundingTx,
        IBridgeTypes.DepositRevealInfo calldata reveal,
        bytes32 extraData
    ) internal returns (uint256) {
        require(reveal.vault == address(tbtcVault), "Vault address mismatch");

        uint256 depositKey = _calculateDepositKey(
            _calculateBitcoinTxHash(fundingTx),
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

        return depositKey;
    }

    /// @notice Finalizes a deposit by calculating the amount of TBTC minted
    ///         for the deposit
    /// @param depositKey Deposit key identifying the deposit.
    /// @return tbtcAmount Approximate amount of TBTC minted for the deposit.
    /// @return extraData 32-byte deposit extra data.
    /// @dev Requirements:
    ///      - The deposit must be initialized but not finalized
    ///        (in the context of this contract) yet.
    ///      - The deposit must be finalized on the Bridge side. That means the
    ///        deposit must be either swept or optimistically minted.
    /// @dev IMPORTANT NOTE: The tbtcAmount returned by this function is an
    ///      approximation. See documentation of the `calculateTbtcAmount`
    ///      responsible for calculating this value for more details.
    // slither-disable-next-line dead-code
    function _finalizeDeposit(uint256 depositKey)
        internal
        returns (uint256 tbtcAmount, bytes32 extraData)
    {
        require(pendingDeposits[depositKey], "Deposit not initialized");

        IBridgeTypes.DepositRequest memory deposit = bridge.deposits(
            depositKey
        );
        (, uint64 finalizedAt) = tbtcVault.optimisticMintingRequests(
            depositKey
        );

        require(
            deposit.sweptAt != 0 || finalizedAt != 0,
            "Deposit not finalized by the bridge"
        );

        // We can safely delete the deposit from the pending deposits mapping.
        // This deposit cannot be initialized again because the bridge does not
        // allow to reveal the same deposit twice. Deleting the deposit from
        // the mapping will also prevent the finalizeDeposit function from
        // being called again for the same deposit.
        // slither-disable-next-line reentrancy-no-eth
        delete pendingDeposits[depositKey];

        tbtcAmount = _calculateTbtcAmount(deposit.amount, deposit.treasuryFee);

        // slither-disable-next-line reentrancy-events
        emit DepositFinalized(
            depositKey,
            tbtcAmount,
            /* solhint-disable-next-line not-rely-on-time */
            uint32(block.timestamp)
        );

        extraData = deposit.extraData;
    }

    /// @notice Calculates the amount of TBTC minted for the deposit.
    /// @param depositAmountSat Deposit amount in satoshi (1e8 precision).
    ///        This is the actual amount deposited by the deposit creator, i.e.
    ///        the gross amount the Bridge's fees are cut from.
    /// @param depositTreasuryFeeSat Deposit treasury fee in satoshi (1e8 precision).
    ///        This is an accurate value of the treasury fee that was actually
    ///        cut upon minting.
    /// @return tbtcAmount Approximate amount of TBTC minted for the deposit.
    /// @dev IMPORTANT NOTE: The tbtcAmount returned by this function may
    ///      not correspond to the actual amount of TBTC minted for the deposit.
    ///      Although the treasury fee cut upon minting is known precisely,
    ///      this is not the case for the optimistic minting fee and the Bitcoin
    ///      transaction fee. To overcome that problem, this function just takes
    ///      the current maximum allowed values of both fees, at the moment of deposit
    ///      finalization. For the great majority of the deposits, such an
    ///      algorithm will return a tbtcAmount slightly lesser than the
    ///      actual amount of TBTC minted for the deposit. This will cause
    ///      some TBTC to be left in the contract and ensure there is enough
    ///      liquidity to finalize the deposit. However, in some rare cases,
    ///      where the actual values of those fees change between the deposit
    ///      minting and finalization, the tbtcAmount returned by this function
    ///      may be greater than the actual amount of TBTC minted for the deposit.
    ///      If this happens and the reserve coming from previous deposits
    ///      leftovers does not provide enough liquidity, the deposit will have
    ///      to wait for finalization until the reserve is refilled by subsequent
    ///      deposits or a manual top-up. The integrator is responsible for
    ///      handling such cases.
    // slither-disable-next-line dead-code
    function _calculateTbtcAmount(
        uint64 depositAmountSat,
        uint64 depositTreasuryFeeSat
    ) internal view virtual returns (uint256) {
        // Both deposit amount and treasury fee are in the 1e8 satoshi precision.
        // We need to convert them to the 1e18 TBTC precision.
        uint256 amountSubTreasury = (depositAmountSat - depositTreasuryFeeSat) *
            SATOSHI_MULTIPLIER;

        uint256 omFeeDivisor = tbtcVault.optimisticMintingFeeDivisor();
        uint256 omFee = omFeeDivisor > 0
            ? (amountSubTreasury / omFeeDivisor)
            : 0;

        // The deposit transaction max fee is in the 1e8 satoshi precision.
        // We need to convert them to the 1e18 TBTC precision.
        (, , uint64 depositTxMaxFee, ) = bridge.depositParameters();
        uint256 txMaxFee = depositTxMaxFee * SATOSHI_MULTIPLIER;

        return amountSubTreasury - omFee - txMaxFee;
    }

    /// @notice Calculates the deposit key for the given funding transaction
    ///         hash and funding output index.
    /// @param fundingTxHash Funding transaction hash.
    /// @param fundingOutputIndex Funding output index.
    /// @return depositKey Deposit key computed as
    ///         `keccak256(fundingTxHash | reveal.fundingOutputIndex)`. This
    ///         key can be used to refer to the deposit in the Bridge and
    ///         TBTCVault contracts.
    // slither-disable-next-line dead-code
    function _calculateDepositKey(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex
    ) internal pure returns (uint256) {
        return
            uint256(
                keccak256(abi.encodePacked(fundingTxHash, fundingOutputIndex))
            );
    }

    /// @notice Calculates the Bitcoin transaction hash for the given Bitcoin
    ///         transaction data.
    /// @param txInfo Bitcoin transaction data, see `IBridgeTypes.BitcoinTxInfo` struct.
    /// @return txHash Bitcoin transaction hash.
    // slither-disable-next-line dead-code
    function _calculateBitcoinTxHash(IBridgeTypes.BitcoinTxInfo calldata txInfo)
        internal
        view
        returns (bytes32)
    {
        return
            abi
                .encodePacked(
                    txInfo.version,
                    txInfo.inputVector,
                    txInfo.outputVector,
                    txInfo.locktime
                )
                .hash256View();
    }
}
