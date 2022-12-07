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

import "../bridge/Bridge.sol";
import "../bridge/Deposit.sol";

abstract contract TBTCOptimisticMinting {

    // TODO: make it governable?
    uint256 public constant optimisticMintingDelay = 3 hours;

    Bridge public bridge;

    mapping(address => bool) public isMinter;
    mapping(address => bool) public isWatchman;

    mapping(uint256 => uint256) public pendingOptimisticMints;

    mapping(address => uint256) public optimisticMintingDebt;

    modifier onlyMinter() {
        require(isMinter[msg.sender], "Caller is not a minter");
        _;
    }

    modifier onlyWatchman() {
        require(isWatchman[msg.sender], "Caller is not a watchman");
        _;
    }

    constructor(Bridge _bridge) {
        require(
            address(_bridge) != address(0),
            "Bridge can not be the zero address"
        );

        bridge = _bridge;
    }

    function _mint(address minter, uint256 amount) virtual internal;

    function optimisticMint(uint256 depositKey) external onlyMinter {
        Deposit.DepositRequest memory deposit = bridge.deposits(depositKey);

        require(deposit.revealedAt != 0, "The deposit has not been revealed");
        require(deposit.sweptAt == 0, "The deposit is already swept");
        require(deposit.vault == address(this), "Unexpected vault address");

        pendingOptimisticMints[depositKey] = block.timestamp;

        // TODO: emit an event
    }

    function finalizeOptimisticMint(uint256 depositKey) external onlyMinter {
        uint256 requestedAt = pendingOptimisticMints[depositKey];
        require(requestedAt != 0, "Optimistic minting not requested");
        require(
            block.timestamp - requestedAt > optimisticMintingDelay,
            "Optimistic minting delay has not passed yet"
        );

        Deposit.DepositRequest memory deposit = bridge.deposits(depositKey);
        require(deposit.sweptAt == 0, "The deposit is already swept");

        // TODO: deal with the minting fee
        _mint(deposit.depositor, deposit.amount);
        optimisticMintingDebt[deposit.depositor] += deposit.amount;

        delete pendingOptimisticMints[depositKey];

        // TODO: emit an event
    }

    // TODO: Is this function convenient enough to block minting at 3AM ?
    //       Do we want to give watchment a chance to temporarily disable
    //       finalizeOptimisticMint ?
    function cancelOptimisticMint(uint256 depositKey) external onlyWatchman {
        delete pendingOptimisticMints[depositKey];

        // TODO: emit an event
    }

    function repayOptimisticMintDebt(address depositor, uint256 amount) internal returns (uint256) {
        uint256 debt = optimisticMintingDebt[depositor];

        if (amount > debt) {
            optimisticMintingDebt[depositor] = 0;
            return amount - debt;
        } else {
            optimisticMintingDebt[depositor] -= amount;
            return 0;
        }

        // TODO: emit an event
    }

    // TODO: functions to manipulate the optimistic minter/watchmen set.
}