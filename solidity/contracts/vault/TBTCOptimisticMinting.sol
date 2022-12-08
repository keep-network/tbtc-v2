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

abstract contract TBTCOptimisticMinting is Ownable {
    // TODO: make it governable?
    uint256 public constant optimisticMintingDelay = 3 hours;

    Bridge public bridge;

    mapping(address => bool) public isMinter;
    mapping(address => bool) public isGuard;

    mapping(uint256 => uint256) public pendingOptimisticMints;

    mapping(address => uint256) public optimisticMintingDebt;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event GuardAdded(address indexed guard);
    event GuardRemoved(address indexed guard);

    modifier onlyMinter() {
        require(isMinter[msg.sender], "Caller is not a minter");
        _;
    }

    modifier onlyGuard() {
        require(isGuard[msg.sender], "Caller is not a guard");
        _;
    }

    constructor(Bridge _bridge) {
        require(
            address(_bridge) != address(0),
            "Bridge can not be the zero address"
        );

        bridge = _bridge;
    }

    function _mint(address minter, uint256 amount) internal virtual;

    function optimisticMint(uint256 depositKey) external onlyMinter {
        Deposit.DepositRequest memory deposit = bridge.deposits(depositKey);

        require(deposit.revealedAt != 0, "The deposit has not been revealed");
        require(deposit.sweptAt == 0, "The deposit is already swept");
        require(deposit.vault == address(this), "Unexpected vault address");

        /* solhint-disable-next-line not-rely-on-time */
        pendingOptimisticMints[depositKey] = block.timestamp;

        // TODO: emit an event
    }

    function finalizeOptimisticMint(uint256 depositKey) external onlyMinter {
        uint256 requestedAt = pendingOptimisticMints[depositKey];
        require(requestedAt != 0, "Optimistic minting not requested");
        require(
            /* solhint-disable-next-line not-rely-on-time */
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
    function cancelOptimisticMint(uint256 depositKey) external onlyGuard {
        delete pendingOptimisticMints[depositKey];

        // TODO: emit an event
    }

    function addMinter(address minter) external onlyOwner {
        require(!isMinter[minter], "This address is already a minter");
        isMinter[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        require(isMinter[minter], "This address is not a minter");
        delete isMinter[minter];
        emit MinterRemoved(minter);
    }

    function addGuard(address guard) external onlyOwner {
        require(!isGuard[guard], "This address is already a guard");
        isGuard[guard] = true;
        emit GuardAdded(guard);
    }

    function removeGuard(address guard) external onlyOwner {
        require(isGuard[guard], "This address is not a guard");
        delete isGuard[guard];
        emit GuardRemoved(guard);
    }

    function repayOptimisticMintDebt(address depositor, uint256 amount)
        internal
        returns (uint256)
    {
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
}
