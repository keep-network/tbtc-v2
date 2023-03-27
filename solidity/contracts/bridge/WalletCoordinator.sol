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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Bridge.sol";
import "./Deposit.sol";
import "./Wallets.sol";

// TODO: Documentation and unit tests.
// TODO: Should we make it pausable?
contract WalletCoordinator is OwnableUpgradeable {
    struct DepositSweepProposal {
        bytes20 walletPubKeyHash;
        bytes32[] fundingTxHash;
        uint32[] fundingOutputIndex;
    }

    Bridge public bridge;

    uint32 public depositSweepProposalValidity;

    uint16 public depositSweepMaxSize;

    mapping(address => bool) public isProposalSubmitter;

    mapping(bytes20 => uint32) public walletLock;

    event DepositSweepProposalValidityUpdated(
        uint32 depositSweepProposalValidity
    );

    event DepositSweepMaxSizeUpdated(uint16 depositSweepMaxSize);

    event ProposalSubmitterAdded(address indexed proposalSubmitter);

    event ProposalSubmitterRemoved(address indexed proposalSubmitter);

    event DepositSweepProposalSubmitted(
        DepositSweepProposal proposal,
        address indexed proposalSubmitter
    );

    modifier onlyProposalSubmitter() {
        require(
            isProposalSubmitter[msg.sender],
            "Caller is not proposal submitter"
        );
        _;
    }

    modifier onlyAfterWalletLock(bytes20 walletPubKeyHash) {
        require(
            /* solhint-disable-next-line not-rely-on-time */
            block.timestamp > walletLock[walletPubKeyHash],
            "Wallet locked"
        );
        _;
    }

    function initialize(Bridge _bridge) external initializer {
        __Ownable_init();

        bridge = _bridge;
        depositSweepProposalValidity = 4 hours;
        depositSweepMaxSize = 5;
    }

    function updateDepositSweepProposalValidity(
        uint32 _depositSweepProposalValidity
    ) external onlyOwner {
        depositSweepProposalValidity = _depositSweepProposalValidity;
        emit DepositSweepProposalValidityUpdated(_depositSweepProposalValidity);
    }

    function updateDepositSweepMaxSize(uint16 _depositSweepMaxSize)
        external
        onlyOwner
    {
        depositSweepMaxSize = _depositSweepMaxSize;
        emit DepositSweepMaxSizeUpdated(_depositSweepMaxSize);
    }

    function addProposalSubmitter(address proposalSubmitter)
        external
        onlyOwner
    {
        require(
            !isProposalSubmitter[proposalSubmitter],
            "This address is already a proposal submitter"
        );
        isProposalSubmitter[proposalSubmitter] = true;
        emit ProposalSubmitterAdded(proposalSubmitter);
    }

    function removeProposalSubmitter(address proposalSubmitter)
        external
        onlyOwner
    {
        require(
            isProposalSubmitter[proposalSubmitter],
            "This address is not a proposal submitter"
        );
        delete isProposalSubmitter[proposalSubmitter];
        emit ProposalSubmitterRemoved(proposalSubmitter);
    }

    // TODO: We can also add an ability for the wallet members to unlock on
    //       their own.
    function unlockWallet(bytes20 walletPubKeyHash) external onlyOwner {
        // Just in case, allow the owner to unlock the wallet earlier.
        walletLock[walletPubKeyHash] = 0;
    }

    function submitDepositSweepProposal(DepositSweepProposal calldata proposal)
        external
        onlyProposalSubmitter
        onlyAfterWalletLock(proposal.walletPubKeyHash)
    {
        walletLock[proposal.walletPubKeyHash] =
            /* solhint-disable-next-line not-rely-on-time */
            uint32(block.timestamp) +
            depositSweepProposalValidity;

        emit DepositSweepProposalSubmitted(proposal, msg.sender);
    }

    function validateDepositSweepProposal(
        DepositSweepProposal calldata proposal
    ) external view {
        require(
            bridge.wallets(proposal.walletPubKeyHash).state ==
                Wallets.WalletState.Live,
            "Wallet is not in Live state"
        );

        require(
            proposal.fundingTxHash.length == proposal.fundingOutputIndex.length,
            "Arrays must have the same length"
        );

        require(
            proposal.fundingTxHash.length <= depositSweepMaxSize,
            "Sweep exceeds the max size"
        );

        for (uint256 i = 0; i < proposal.fundingTxHash.length; i++) {
            uint256 depositKey = uint256(
                keccak256(
                    abi.encodePacked(
                        proposal.fundingTxHash[i],
                        proposal.fundingOutputIndex[i]
                    )
                )
            );

            // slither-disable-next-line calls-loop
            Deposit.DepositRequest memory deposit = bridge.deposits(depositKey);

            require(deposit.sweptAt == 0, "Deposit already swept");

            // TODO: Check deposit was revealed enough time ago to ensure block finality.
            // TODO: Check deposit will not become refundable soon.
        }

        // TODO: What else?
    }
}
