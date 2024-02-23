// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.0;

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";

import "../integrator/AbstractTBTCDepositor.sol";
import "../integrator/IBridge.sol";
import "../integrator/ITBTCVault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestTBTCDepositor is AbstractTBTCDepositor {
    event InitializeDepositReturned(uint256 depositKey);

    event FinalizeDepositReturned(
        uint256 initialDepositAmount,
        uint256 tbtcAmount,
        bytes32 extraData
    );

    function initialize(address _bridge, address _tbtcVault) external {
        __AbstractTBTCDepositor_initialize(_bridge, _tbtcVault);
    }

    function initializeDepositPublic(
        IBridgeTypes.BitcoinTxInfo calldata fundingTx,
        IBridgeTypes.DepositRevealInfo calldata reveal,
        bytes32 extraData
    ) external {
        uint256 depositKey = _initializeDeposit(fundingTx, reveal, extraData);
        emit InitializeDepositReturned(depositKey);
    }

    function finalizeDepositPublic(uint256 depositKey) external {
        (
            uint256 initialDepositAmount,
            uint256 tbtcAmount,
            bytes32 extraData
        ) = _finalizeDeposit(depositKey);
        emit FinalizeDepositReturned(
            initialDepositAmount,
            tbtcAmount,
            extraData
        );
    }

    function calculateTbtcAmountPublic(
        uint64 depositAmountSat,
        uint64 depositTreasuryFeeSat
    ) external view returns (uint256) {
        return _calculateTbtcAmount(depositAmountSat, depositTreasuryFeeSat);
    }
}

contract MockBridge is IBridge {
    using BTCUtils for bytes;

    mapping(uint256 => IBridgeTypes.DepositRequest) internal _deposits;

    uint64 internal _depositDustThreshold = 1000000; // 1000000 satoshi = 0.01 BTC
    uint64 internal _depositTreasuryFeeDivisor = 50; // 1/50 == 100 bps == 2% == 0.02
    uint64 internal _depositTxMaxFee = 1000; // 1000 satoshi = 0.00001 BTC

    event DepositRevealed(uint256 depositKey);

    function revealDepositWithExtraData(
        IBridgeTypes.BitcoinTxInfo calldata fundingTx,
        IBridgeTypes.DepositRevealInfo calldata reveal,
        bytes32 extraData
    ) external {
        bytes32 fundingTxHash = abi
            .encodePacked(
                fundingTx.version,
                fundingTx.inputVector,
                fundingTx.outputVector,
                fundingTx.locktime
            )
            .hash256View();

        uint256 depositKey = uint256(
            keccak256(
                abi.encodePacked(fundingTxHash, reveal.fundingOutputIndex)
            )
        );

        require(
            _deposits[depositKey].revealedAt == 0,
            "Deposit already revealed"
        );

        bytes memory fundingOutput = fundingTx
            .outputVector
            .extractOutputAtIndex(reveal.fundingOutputIndex);

        uint64 fundingOutputAmount = fundingOutput.extractValue();

        IBridgeTypes.DepositRequest memory request;

        request.depositor = msg.sender;
        request.amount = fundingOutputAmount;
        /* solhint-disable-next-line not-rely-on-time */
        request.revealedAt = uint32(block.timestamp);
        request.vault = reveal.vault;
        request.treasuryFee = _depositTreasuryFeeDivisor > 0
            ? fundingOutputAmount / _depositTreasuryFeeDivisor
            : 0;
        request.sweptAt = 0;
        request.extraData = extraData;

        _deposits[depositKey] = request;

        emit DepositRevealed(depositKey);
    }

    function sweepDeposit(uint256 depositKey) public {
        require(_deposits[depositKey].revealedAt != 0, "Deposit not revealed");
        require(_deposits[depositKey].sweptAt == 0, "Deposit already swept");
        /* solhint-disable-next-line not-rely-on-time */
        _deposits[depositKey].sweptAt = uint32(block.timestamp);
    }

    function deposits(uint256 depositKey)
        external
        view
        returns (IBridgeTypes.DepositRequest memory)
    {
        return _deposits[depositKey];
    }

    function depositParameters()
        external
        view
        returns (
            uint64 depositDustThreshold,
            uint64 depositTreasuryFeeDivisor,
            uint64 depositTxMaxFee,
            uint32 depositRevealAheadPeriod
        )
    {
        depositDustThreshold = _depositDustThreshold;
        depositTreasuryFeeDivisor = _depositTreasuryFeeDivisor;
        depositTxMaxFee = _depositTxMaxFee;
        depositRevealAheadPeriod = 0;
    }

    function setDepositDustThreshold(uint64 value) external {
        _depositDustThreshold = value;
    }

    function setDepositTreasuryFeeDivisor(uint64 value) external {
        _depositTreasuryFeeDivisor = value;
    }

    function setDepositTxMaxFee(uint64 value) external {
        _depositTxMaxFee = value;
    }
}

contract MockTBTCVault is ITBTCVault {
    struct Request {
        uint64 requestedAt;
        uint64 finalizedAt;
    }

    mapping(uint256 => Request) internal _requests;

    uint32 public optimisticMintingFeeDivisor = 100; // 1%

    function optimisticMintingRequests(uint256 depositKey)
        external
        returns (uint64 requestedAt, uint64 finalizedAt)
    {
        Request memory request = _requests[depositKey];
        return (request.requestedAt, request.finalizedAt);
    }

    /// @dev The function is virtual to allow other projects using this mock
    ///      for AbtractTBTCDepositor-based contract tests to add any custom
    ///      logic needed.
    function createOptimisticMintingRequest(uint256 depositKey) public virtual {
        require(
            _requests[depositKey].requestedAt == 0,
            "Request already exists"
        );
        /* solhint-disable-next-line not-rely-on-time */
        _requests[depositKey].requestedAt = uint64(block.timestamp);
    }

    /// @dev The function is virtual to allow other projects using this mock
    ///      for AbtractTBTCDepositor-based contract tests to add any custom
    ///      logic needed.
    function finalizeOptimisticMintingRequest(uint256 depositKey)
        public
        virtual
    {
        require(
            _requests[depositKey].requestedAt != 0,
            "Request does not exist"
        );
        require(
            _requests[depositKey].finalizedAt == 0,
            "Request already finalized"
        );
        /* solhint-disable-next-line not-rely-on-time */
        _requests[depositKey].finalizedAt = uint64(block.timestamp);
    }

    function setOptimisticMintingFeeDivisor(uint32 value) external {
        optimisticMintingFeeDivisor = value;
    }
}
