pragma solidity 0.8.4;

/// @title BTC Bridge
/// @notice Bridge manages BTC deposit and redemption and is increasing and
///         decreasing balances in the Bank as a result of BTC deposit and
///         redemption operations.
///
///         Depositors send BTC funds to the most-recently-created-wallet of the
///         bridge using pay-to-script-hash (P2SH) which contains hashed
///         information about the depositor’s minting Ethereum address. Then,
///         the depositor reveals their desired Ethereum minting address to the
///         Ethereum chain. The Bridge listens for these sorts of messages and
///         when it gets one, it checks the Bitcoin network to make sure the
///         funds line up. If they do, the off-chain wallet may decide to pick
///         this transaction for sweeping, and when the sweep operation is
///         confirmed on the Bitcoin network, the wallet informs the Bridge
///         about the sweep increasing appropriate balances in the Bank.
/// @dev Bridge is an upgradeable component of the Bank.
contract Bridge {
    struct DepositInfo {
        uint64 amount;
        address vault;
        uint32 revealedAt;
    }

    /// @notice Collection of all unswept deposits indexed by
    ///         keccak256(fundingTxHash | fundingOutputIndex | depositorAddress).
    ///         This mapping may contain valid and invalid deposits and the
    ///         wallet is responsible for validating them before attempting to
    ///         execute a sweep.
    mapping(uint256 => DepositInfo) public unswept;

    event DepositRevealed(
        uint256 depositId,
        bytes32 fundingTxHash,
        uint8 fundingOutputIndex,
        address depositor,
        uint64 blindingFactor,
        bytes refundPubKey,
        uint64 amount,
        address vault
    );

    /// @notice Used by the depositor to reveal information about their P2SH
    ///         Bitcoin deposit to the Bridge on Ethereum chain. The off-chain
    ///         wallet listens for revealed deposit events and may decide to
    ///         include the revealed deposit in the next executed sweep.
    ///         Information about the Bitcoin deposit can be revealed before or
    ///         after the Bitcoin transaction with P2SH deposit is mined on the
    ///         Bitcoin chain.
    /// @param fundingTxHash The BTC transaction hash containing BTC P2SH
    ///        deposit funding transaction
    /// @param fundingOutputIndex The index of the transaction output in the
    ///        funding TX with P2SH deposit, max 256
    /// @param blindingFactor The blinding factor used in the BTC P2SH deposit,
    ///        max 2^64
    /// @param refundPubKey The refund pub key used in the BTC P2SH deposit
    /// @param amount The amount locked in the BTC P2SH deposit
    /// @param vault Bank vault to which the swept deposit should be routed
    /// @dev Requirements:
    ///      - `msg.sender` must be the Ethereum address used in the P2SH BTC deposit,
    ///      - `blindingFactor` must be the blinding factor used in the P2SH BTC deposit,
    ///      - `refundPubKey` must be the refund pub key used in the P2SH BTC deposit,
    ///      - `amount` must be the same as locked in the P2SH BTC deposit,
    ///      - BTC deposit for the given `fundingTxHash`, `fundingOutputIndex`
    ///        can be revealed by `msg.sender` only one time.
    ///
    ///      If any of these requirements is not met, the wallet _must_ refuse
    ///      to sweep the deposit and the depositor has to wait until the
    ///      deposit script unlocks to receive their BTC back.
    function revealDeposit(
        bytes32 fundingTxHash,
        uint8 fundingOutputIndex,
        uint64 blindingFactor,
        bytes calldata refundPubKey,
        uint64 amount,
        address vault
    ) external {
        uint256 depositId =
            uint256(
                keccak256(
                    abi.encode(fundingTxHash, fundingOutputIndex, msg.sender)
                )
            );

        DepositInfo storage deposit = unswept[depositId];
        require(deposit.revealedAt == 0, "Deposit already revealed");

        deposit.amount = amount;
        deposit.vault = vault;
        /* solhint-disable-next-line not-rely-on-time */
        deposit.revealedAt = uint32(block.timestamp);

        emit DepositRevealed(
            depositId,
            fundingTxHash,
            fundingOutputIndex,
            msg.sender,
            blindingFactor,
            refundPubKey,
            amount,
            vault
        );
    }

    /// @notice Used by the wallet to prove the BTC deposit sweep transaction
    ///         and to update Bank balances accordingly. Sweep is only accepted
    ///         if it satisfies SPV proof.
    ///
    ///         The function is performing Bank balance updates by first
    ///         computing the Bitcoin fee for the sweep transaction. The fee is
    ///         divided evenly between all swept deposits. Each depositor
    ///         receives a balance in the bank equal to the amount they have
    ///         declared during the reveal transaction, minus their fee share.
    /// @param txVersion Transaction version number (4-byte LE)
    /// @param txInputVector All transaction inputs prepended by the number of
    ///                      inputs encoded as a VarInt, max 0xFC(252) inputs
    /// @param txOutput Single sweep transaction output
    /// @param txLocktime Final 4 bytes of the transaction
    /// @param merkleProof The merkle proof of transaction inclusion in a block
    /// @param txIndexInBlock Transaction index in the block (0-indexed)
    /// @param bitcoinHeaders Single bytestring of 80-byte bitcoin headers,
    ///                       lowest height first
    function sweep(
        bytes4 txVersion,
        bytes memory txInputVector,
        bytes memory txOutput,
        bytes4 txLocktime,
        bytes memory merkleProof,
        uint256 txIndexInBlock,
        bytes memory bitcoinHeaders
    ) external {
        // TODO We need to read `fundingTxHash`, `fundingOutputIndex` and
        //      P2SH script depositor address from `txInputVector`.
        //      We then hash them to obtain deposit identifier and read
        //      DepositInfo. From DepositInfo we know what amount was declared
        //      by the depositor in their reveal transaction and we use that
        //      amount to update their Bank balance, minus fee.
        //
        // TODO We need to validate if the sum in the output minus the
        //      amount from the previous wallet balance input minus fees is
        //      equal to the amount by which Bank balances were increased.
        //
        // TODO We need to validate txOutput to see if the balance was not
        //      transferred away from the wallet before increasing balances in
        //      the bank.
    }

    // TODO It is possible a malicious wallet can sweep deposits that can not
    //      be later proved on Ethereum. For example, a deposit with
    //      an incorrect amount revealed. We need to provide a function for honest
    //      depositors, next to sweep, to prove their swept balances on Ethereum
    //      selectively, based on deposits they have earlier received.
}
