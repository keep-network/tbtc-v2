pragma solidity 0.8.4;

import {BTCUtils} from "./BTCUtils.sol";
import {BytesLib} from "./BytesLib.sol";

/// @title BTC Bridge
/// @notice Bridge manages BTC deposit and redemption and is increasing and
///         decreasing balances in the Bank as a result of BTC deposit and
///         redemption operations.
///
///         Depositors send BTC funds to the most-recently-created-wallet of the
///         bridge using pay-to-script-hash (P2SH) or
///         pay-to-witness-script-hash (P2WSH) which contains hashed
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
    // TODO: Consider using a custom fork of Summa libs adjusted to Solidity 8.
    using BTCUtils for bytes;
    using BytesLib for bytes;

    /// @notice Represents Bitcoin transaction data as described in:
    ///         https://developer.bitcoin.org/reference/transactions.html#raw-transaction-format
    struct TxInfo {
        // Transaction version number (4-byte LE).
        bytes4 version;
        // All transaction inputs prepended by the number of inputs encoded
        // as a VarInt. Single vector item looks as follows:
        // https://developer.bitcoin.org/reference/transactions.html#txin-a-transaction-input-non-coinbase
        // though SegWit inputs don't contain the signature script (scriptSig).
        // All encoded input transaction hashes are little-endian.
        bytes inputVector;
        // All transaction outputs prepended by the number of outputs encoded
        // as a VarInt. Single vector item looks as follows:
        // https://developer.bitcoin.org/reference/transactions.html#txout-a-transaction-output
        bytes outputVector;
        // Transaction locktime (4-byte LE).
        bytes4 locktime;
    }

    /// @notice Represents data which must be revealed by the depositor during
    ///         deposit reveal.
    struct RevealInfo {
        // Index of the funding output belonging to the funding transaction.
        uint8 fundingOutputIndex;
        // Ethereum depositor address.
        address depositor;
        // The blinding factor as 8 bytes. Byte endianness doesn't matter
        // as this factor is not interpreted as uint.
        bytes8 blindingFactor;
        // The compressed Bitcoin public key (33 bytes and 02 or 03 prefix)
        // of the deposit's wallet.
        bytes walletPubKey;
        // The compressed Bitcoin public key (33 bytes and 02 or 03 prefix)
        // that can be used to make the deposit refund after the refund
        // locktime passes.
        bytes refundPubKey;
        // The refund locktime (4-byte LE). Interpreted according to locktime
        // parsing rules described in:
        // https://developer.bitcoin.org/devguide/transactions.html#locktime-and-sequence-number
        // and used with OP_CHECKLOCKTIMEVERIFY opcode as described in:
        // https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki
        bytes4 refundLocktime;
        // Address of the tBTC vault.
        address vault;
    }

    /// @notice Represents tBTC deposit data.
    struct DepositInfo {
        // Ethereum depositor address.
        address depositor;
        // Deposit amount in satoshi (8-byte LE). For example:
        // 0.0001 BTC = 10000 satoshi = 0x1027000000000000
        bytes8 amount;
        // UNIX timestamp the deposit was revealed at.
        uint32 revealedAt;
        // Address of the tBTC vault.
        address vault;
    }

    /// @notice Collection of all unswept deposits indexed by
    ///         keccak256(fundingTxHash | fundingOutputIndex).
    ///         The fundingTxHash is LE bytes32 and fundingOutputIndex an uint8.
    ///         This mapping may contain valid and invalid deposits and the
    ///         wallet is responsible for validating them before attempting to
    ///         execute a sweep.
    mapping(uint256 => DepositInfo) public unswept;

    event DepositRevealed(
        bytes32 fundingTxHash,
        uint8 fundingOutputIndex,
        address depositor,
        bytes8 blindingFactor,
        bytes walletPubKey,
        bytes refundPubKey,
        bytes4 refundLocktime
    );

    /// @notice Used by the depositor to reveal information about their P2(W)SH
    ///         Bitcoin deposit to the Bridge on Ethereum chain. The off-chain
    ///         wallet listens for revealed deposit events and may decide to
    ///         include the revealed deposit in the next executed sweep.
    ///         Information about the Bitcoin deposit can be revealed before or
    ///         after the Bitcoin transaction with P2(W)SH deposit is mined on
    ///         the Bitcoin chain. Worth noting the gas cost of this function
    ///         scales with the number of P2(W)SH transaction inputs and
    ///         outputs.
    /// @param fundingTx Bitcoin funding transaction data.
    /// @param reveal Deposit reveal data.
    /// @dev Requirements:
    ///      - `reveal.fundingOutputIndex` must point to the actual P2(W)SH
    ///        output of the BTC deposit transaction
    ///      - `reveal.depositor` must be the Ethereum address used in the
    ///        P2(W)SH BTC deposit transaction,
    ///      - `reveal.blindingFactor` must be the blinding factor used in the
    ///        P2(W)SH BTC deposit transaction,
    ///      - `reveal.walletPubKey` must be the wallet pub key used in the
    ///        P2(W)SH BTC deposit transaction,
    ///      - `reveal.refundPubKey` must be the refund pub key used in the
    ///        P2(W)SH BTC deposit transaction,
    ///      - `reveal.refundLocktime` must be the refund locktime used in the
    ///        P2(W)SH BTC deposit transaction,
    ///      - BTC deposit for the given `fundingTxHash`, `fundingOutputIndex`
    ///        can be revealed only one time.
    ///
    ///      If any of these requirements is not met, the wallet _must_ refuse
    ///      to sweep the deposit and the depositor has to wait until the
    ///      deposit script unlocks to receive their BTC back.
    function revealDeposit(
        TxInfo calldata fundingTx,
        RevealInfo calldata reveal
    ) external {
        bytes memory expectedScript =
            abi.encodePacked(
                hex"14", // Byte length of depositor Ethereum address.
                reveal.depositor,
                hex"75", // OP_DROP
                hex"08", // Byte length of blinding factor value.
                reveal.blindingFactor,
                hex"75", // OP_DROP
                hex"76", // OP_DUP
                hex"a9", // OP_HASH160
                hex"21", // Byte length of a compressed Bitcoin public key.
                reveal.walletPubKey,
                hex"87", // OP_EQUAL
                hex"63", // OP_IF
                hex"ac", // OP_CHECKSIG
                hex"67", // OP_ELSE
                hex"76", // OP_DUP
                hex"a9", // OP_HASH160
                hex"21", // Byte length of a compressed Bitcoin public key.
                reveal.refundPubKey,
                hex"88", // OP_EQUALVERIFY
                hex"04", // Byte length of refund locktime value.
                reveal.refundLocktime,
                hex"b1", // OP_CHECKLOCKTIMEVERIFY
                hex"75", // OP_DROP
                hex"ac", // OP_CHECKSIG
                hex"68" // OP_ENDIF
            );

        bytes memory fundingOutput =
            fundingTx.outputVector.extractOutputAtIndex(
                reveal.fundingOutputIndex
            );
        bytes memory fundingOutputHash = fundingOutput.extractHash();

        if (fundingOutputHash.length == 20) {
            // A 20-byte output hash is used by P2SH. That hash is constructed
            // by applying OP_HASH160 on the redeem script. A 20-byte output
            // hash is also the case for P2PKH and P2WPKH (OP_HASH160 on the
            // public key). However, since we compare the actual output hash
            // with an expected redeem script hash, the transaction type
            // doesn't matter since the check will success only for P2SH
            // with expected script hash value.
            require(
                keccak256(fundingOutputHash) ==
                    keccak256(expectedScript.hash160()),
                "Wrong 20-byte script hash"
            );
        } else if (fundingOutputHash.length == 32) {
            // A 32-byte output hash is used by P2WSH. That hash is constructed
            // by applying OP_HASH256 on the redeem script.
            require(
                fundingOutputHash.toBytes32() == expectedScript.hash256(),
                "Wrong 32-byte script hash"
            );
        } else {
            revert("Wrong script hash length");
        }

        // Resulting TX hash is in native Bitcoin little-endian format.
        bytes32 fundingTxHash =
            abi
                .encodePacked(
                fundingTx
                    .version,
                fundingTx
                    .inputVector,
                fundingTx
                    .outputVector,
                fundingTx
                    .locktime
            )
                .hash256();

        DepositInfo storage deposit =
            unswept[
                uint256(
                    keccak256(
                        abi.encodePacked(
                            fundingTxHash,
                            reveal.fundingOutputIndex
                        )
                    )
                )
            ];
        require(deposit.revealedAt == 0, "Deposit already revealed");

        bytes8 fundingOutputAmountLE;
        /* solhint-disable-next-line no-inline-assembly */
        assembly {
            // First 8 bytes (little-endian) of the funding output represents
            // its value. To take the value, we need to jump over the first
            // word determining the array length, load the array, and trim it
            // by putting it to a bytes8.
            fundingOutputAmountLE := mload(add(fundingOutput, 32))
        }

        deposit.amount = fundingOutputAmountLE;
        deposit.depositor = reveal.depositor;
        /* solhint-disable-next-line not-rely-on-time */
        deposit.revealedAt = uint32(block.timestamp);
        deposit.vault = reveal.vault;

        emit DepositRevealed(
            fundingTxHash,
            reveal.fundingOutputIndex,
            reveal.depositor,
            reveal.blindingFactor,
            reveal.walletPubKey,
            reveal.refundPubKey,
            reveal.refundLocktime
        );
    }

    /// @notice Used by the wallet to prove the BTC deposit sweep transaction
    ///         and to update Bank balances accordingly. Sweep is only accepted
    ///         if it satisfies SPV proof.
    ///
    ///         The function is performing Bank balance updates by first
    ///         computing the Bitcoin fee for the sweep transaction. The fee is
    ///         divided evenly between all swept deposits. Each depositor
    ///         receives a balance in the bank equal to the amount inferred
    ///         during the reveal transaction, minus their fee share.
    ///
    ///         It is possible to prove the given sweep only one time.
    /// @param sweepTx Bitcoin sweep transaction data.
    /// @param merkleProof The merkle proof of transaction inclusion in a block.
    /// @param txIndexInBlock Transaction index in the block (0-indexed).
    /// @param bitcoinHeaders Single bytestring of 80-byte bitcoin headers,
    ///                       lowest height first.
    function sweep(
        TxInfo calldata sweepTx,
        bytes memory merkleProof,
        uint256 txIndexInBlock,
        bytes memory bitcoinHeaders
    ) external {
        // TODO We need to read `fundingTxHash`, `fundingOutputIndex` from
        //      `sweepTx.inputVector`. We then hash them to obtain deposit
        //      identifier and read DepositInfo. From DepositInfo we know what
        //      amount was inferred during deposit reveal transaction and we
        //      use that amount to update their Bank balance, minus fee.
        //
        // TODO We need to validate if the sum in the output minus the
        //      amount from the previous wallet balance input minus fees is
        //      equal to the amount by which Bank balances were increased.
        //
        // TODO We need to validate `sweepTx.outputVector` to see if the balance
        //      was not transferred away from the wallet before increasing
        //      balances in the bank.
        //
        // TODO Delete deposit from unswept mapping or mark it as swept
        //      depending on the gas costs. Alternatively, do not allow to
        //      use the same TX input vector twice. Sweep should be provable
        //      only one time.
    }

    // TODO It is possible a malicious wallet can sweep deposits that can not
    //      be later proved on Ethereum. For example, a deposit with
    //      an incorrect amount revealed. We need to provide a function for honest
    //      depositors, next to sweep, to prove their swept balances on Ethereum
    //      selectively, based on deposits they have earlier received.
    //      (UPDATE PR #90: Is it still the case since amounts are inferred?)
}
