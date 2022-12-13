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

/// @title TBTC Optimistic Minting
/// @notice The Optimistic Minting mechanism allows to mint TBTC before
///         TBTCVault receives the Bank balance. There are two permissioned sets
///         in the system: Minters and Guardians, both set up in 1-of-n mode.
///         Minters observe the revealed deposits and request minting TBTC.
///         Any single Minter can perform this action. There is a 3 hours delay
///         between the time of the request from a Minter to the time TBTC is
///         minted. During the time of the delay, any Guardian can cancel the
///         minting.
/// @dev This functionality is a part of TBTCVault. It is implemented in
///      a separate abstract contract to achieve better separation of concerns
///      and easier-to-follow code.
abstract contract TBTCOptimisticMinting is Ownable {
    /// @notice The time that needs to pass between the moment the optimistic
    ///         minting is requested and the moment optimistic minting is
    ///         finalized with minting TBTC.
    uint256 public constant OPTIMISTIC_MINTING_DELAY = 3 hours;

    Bridge public bridge;

    /// @notice Indicates if the given address is a Minter. Only Minters can
    ///         request optimistic minting.
    mapping(address => bool) public isMinter;

    /// @notice Indicates if the given address is a Guardian. Only Guardians can
    ///         cancel requested optimistic minting.
    mapping(address => bool) public isGuardian;

    /// @notice Indicates if the optimistic minting has been paused. Only the
    ///         Governance can pause optimistic minting. Note that the pause of
    ///         the optimistic minting does not stop the standard minting flow
    ///         where wallets sweep deposits.
    bool public isOptimisticMintingPaused;

    /// @notice Collection of all revealed deposits for which the optimistic
    ///         minting was requested. Indexed by a deposit key computed as
    ///         keccak256(fundingTxHash | fundingOutputIndex). The value is
    ///         a UNIX timestamp at which the optimistic minting was requested.
    mapping(uint256 => uint256) public pendingOptimisticMints;

    /// @notice Optimistic minting debt value per depositor's address. The debt
    ///         represents the total value of all depositor's deposits revealed
    ///         to the Bridge that has not been yet swept and led to the
    ///         optimistic minting of TBTC. When TBTCVault sweeps a deposit,
    ///         the debt is fully or partially paid off, no matter if that
    ///         particular swept deposit was used for the optimistic minting or
    ///         not.
    mapping(address => uint256) public optimisticMintingDebt;

    event OptimisticMintingRequested(
        address indexed minter,
        address depositor,
        uint256 amount,
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex,
        uint256 depositKey
    );
    event OptimisticMintingFinalized(
        address indexed minter,
        address depositor,
        uint256 amount,
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex,
        uint256 depositKey
    );
    event OptimisticMintingCancelled(
        address indexed guardian,
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex,
        uint256 depositKey
    );
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event OptimisticMintingPaused();
    event OptimisticMintingUnpaused();

    modifier onlyMinter() {
        require(isMinter[msg.sender], "Caller is not a minter");
        _;
    }

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "Caller is not a guardian");
        _;
    }

    modifier onlyOwnerOrGuardian() {
        require(
            owner() == msg.sender || isGuardian[msg.sender],
            "Caller is not the owner or guardian"
        );
        _;
    }

    modifier whenOptimisticMintingNotPaused() {
        require(!isOptimisticMintingPaused, "Optimistic minting paused");
        _;
    }

    constructor(Bridge _bridge) {
        require(
            address(_bridge) != address(0),
            "Bridge can not be the zero address"
        );

        bridge = _bridge;
    }

    /// @dev Mints the given amount of TBTC to the given depositor's address.
    ///      Implemented by TBTCVault.
    function _mint(address minter, uint256 amount) internal virtual;

    /// @notice Allows a Minter to request for an optimistic minting of TBTC.
    ///         The following conditions must be met:
    ///         - The deposit with the given Bitcoin funding transaction hash
    ///           and output index has been revealed to the Bridge.
    ///         - The deposit has not been swept yet.
    ///         - The deposit is targeted into the TBTCVault.
    ///         - The optimistic minting is not paused.
    ///         After calling this function, the Minter has to wait for
    ///         OPTIMISTIC_MINTING_DELAY before finalizing the mint with a call
    ///         to finalizeOptimisticMint.
    /// @dev The deposit done on the Bitcoin side must be revealed early enough
    ///      to the Bridge on Ethereum to pass the Bridge's validation. The
    ///      validation passes successfully only if the deposit reveal is done
    ///      respectively earlier than the moment when the deposit refund
    ///      locktime is reached, i.e. the deposit becomes refundable. It may
    ///      happen that the wallet does not sweep a revealed deposit and one of
    ///      the Minters requests an optimistic mint for that deposit just
    ///      before the locktime is reached. Guardians must cancel optimistic
    ///      minting for this deposit because the wallet will not be able to
    ///      sweep it. The on-chain optimistic minting code does not perform any
    ///      validation for gas efficiency: it would have to perform the same
    ///      validation as `validateDepositRefundLocktime` and expect the entire
    ///      `DepositRevealInfo` to be passed to assemble the expected script
    ///      hash on-chain. Guardians must validate if the deposit happened on
    ///      Bitcoin, that the script hash has the expected format, and that the
    ///      wallet is an active one so they can also validate the time left for
    ///      the refund.
    function optimisticMint(bytes32 fundingTxHash, uint32 fundingOutputIndex)
        external
        onlyMinter
        whenOptimisticMintingNotPaused
    {
        uint256 depositKey = calculateDepositKey(
            fundingTxHash,
            fundingOutputIndex
        );
        Deposit.DepositRequest memory deposit = bridge.deposits(depositKey);

        require(deposit.revealedAt != 0, "The deposit has not been revealed");
        require(deposit.sweptAt == 0, "The deposit is already swept");
        require(deposit.vault == address(this), "Unexpected vault address");

        /* solhint-disable-next-line not-rely-on-time */
        pendingOptimisticMints[depositKey] = block.timestamp;

        emit OptimisticMintingRequested(
            msg.sender,
            deposit.depositor,
            deposit.amount,
            fundingTxHash,
            fundingOutputIndex,
            depositKey
        );
    }

    /// @notice Allows a Minter to finalize previously requested optimistic
    ///         minting. The following conditions must be met:
    ///         - The optimistic minting has been requested for the given
    ///           deposit.
    ///         - The deposit has not been swept yet.
    ///         - At least OPTIMISTIC_MINTING_DELAY passed since the optimistic
    ///           minting was requested for the given deposit.
    ///         - The optimistic minting has not been finalized earlier for the
    ///           given deposit.
    ///         - The optimistic minting request for the given deposit has not
    ///           been canceled by a Guardian.
    ///         - The optimistic minting is not paused.
    ///         This function mints TBTC and increases pendingOptimisticMints
    ///         for the given depositor. The finalized optimistic minting
    ///         request is removed from the contract.
    function finalizeOptimisticMint(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex
    ) external onlyMinter whenOptimisticMintingNotPaused {
        uint256 depositKey = calculateDepositKey(
            fundingTxHash,
            fundingOutputIndex
        );

        uint256 requestedAt = pendingOptimisticMints[depositKey];
        require(
            requestedAt != 0,
            "Optimistic minting not requested or already finalized"
        );
        require(
            /* solhint-disable-next-line not-rely-on-time */
            block.timestamp - requestedAt > OPTIMISTIC_MINTING_DELAY,
            "Optimistic minting delay has not passed yet"
        );

        Deposit.DepositRequest memory deposit = bridge.deposits(depositKey);
        require(deposit.sweptAt == 0, "The deposit is already swept");

        // Bridge, when sweeping, cuts a deposit treasury fee and splits
        // Bitcoin miner fee for the sweep transaction evenly between the
        // depositors in the sweep.
        //
        // When tokens are optimistically minted, we do not know what the
        // Bitcoin miner fee for the sweep transaction will look like.
        // The Bitcoin miner fee is ignored. When sweeping, the miner fee is
        // subtracted so the optimisticMintingDebt may stay non-zero after the
        // deposit is swept.
        //
        // This imbalance is supposed to be solved by a donation to the Bridge.
        uint256 amountToMint = deposit.amount - deposit.treasuryFee;
        _mint(deposit.depositor, amountToMint);
        optimisticMintingDebt[deposit.depositor] += amountToMint;

        delete pendingOptimisticMints[depositKey];

        emit OptimisticMintingFinalized(
            msg.sender,
            deposit.depositor,
            amountToMint,
            fundingTxHash,
            fundingOutputIndex,
            depositKey
        );
    }

    /// @notice Allows a Guardian to cancel optimistic minting request. The
    ///         following conditions must be met:
    ///         - The optimistic minting request for the given deposit exists.
    ///         - The optimistic minting request for the given deposit has not
    ///           been finalized yet.
    /// @dev Guardians must validate the following conditions for every deposit
    ///      for which the optimistic minting was requested:
    ///      - The deposit happened on Bitcoin side and it has enough
    ///        confirmations.
    ///      - The optimistic minting has been requested early enough so that
    ///        the wallet has enough time to sweep the deposit.
    ///      - The wallet is an active one and it does perform sweeps or it will
    ///        perform sweeps once the sweeps are activated.
    function cancelOptimisticMint(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex
    ) external onlyGuardian {
        uint256 depositKey = calculateDepositKey(
            fundingTxHash,
            fundingOutputIndex
        );

        require(
            pendingOptimisticMints[depositKey] > 0,
            "Optimistic minting not requested of already finalized"
        );

        delete pendingOptimisticMints[depositKey];

        emit OptimisticMintingCancelled(
            msg.sender,
            fundingTxHash,
            fundingOutputIndex,
            depositKey
        );
    }

    /// @notice Adds the address to the Minter set.
    function addMinter(address minter) external onlyOwner {
        require(!isMinter[minter], "This address is already a minter");
        isMinter[minter] = true;
        emit MinterAdded(minter);
    }

    /// @notice Removes the address from the Minter set.
    function removeMinter(address minter) external onlyOwnerOrGuardian {
        require(isMinter[minter], "This address is not a minter");
        delete isMinter[minter];
        emit MinterRemoved(minter);
    }

    /// @notice Adds the address to the Guardian set.
    function addGuardian(address guardian) external onlyOwner {
        require(!isGuardian[guardian], "This address is already a guardian");
        isGuardian[guardian] = true;
        emit GuardianAdded(guardian);
    }

    /// @notice Removes the address from the Guardian set.
    function removeGuardian(address guardian) external onlyOwner {
        require(isGuardian[guardian], "This address is not a guardian");
        delete isGuardian[guardian];
        emit GuardianRemoved(guardian);
    }

    /// @notice Pauses the optimistic minting. Note that the pause of the
    ///         optimistic minting does not stop the standard minting flow
    ///         where wallets sweep deposits.
    function pauseOptimisticMinting() external onlyOwner {
        require(
            !isOptimisticMintingPaused,
            "Optimistic minting already paused"
        );
        isOptimisticMintingPaused = true;
        emit OptimisticMintingPaused();
    }

    /// @notice Unpauses the optimistic minting.
    function unpauseOptimisticMinting() external onlyOwner {
        require(isOptimisticMintingPaused, "Optimistic minting is not paused");
        isOptimisticMintingPaused = false;
        emit OptimisticMintingUnpaused();
    }

    /// @notice Calculates deposit key the same way as the Bridge contract.
    ///         The deposit key is computed as
    ///         keccak256(fundingTxHash | fundingOutputIndex).
    function calculateDepositKey(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex
    ) public view returns (uint256) {
        return
            uint256(
                keccak256(abi.encodePacked(fundingTxHash, fundingOutputIndex))
            );
    }

    /// @notice Used by TBTCVault.receiveBalanceIncrease to repay the optimistic
    ///         minting debt before TBTC is minted. When optimistic minting is
    ///         finalized, debt equal to the value of the deposit being
    ///         a subject of the optimistic minting is incurred. When TBTCVault
    ///         sweeps a deposit, the debt is fully or partially paid off, no
    ///         matter if that particular deposit was used for the optimistic
    ///         minting or not.
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

        // TODO: cover with unit tests
    }
}
