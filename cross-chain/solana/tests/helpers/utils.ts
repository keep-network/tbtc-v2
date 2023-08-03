import { web3 } from "@coral-xyz/anchor";
import { Account, TokenAccountNotFoundError, createAssociatedTokenAccountIdempotentInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

export async function transferLamports(connection: web3.Connection, fromSigner: web3.Keypair, toPubkey: web3.PublicKey, lamports: number) {
    return sendAndConfirmTransaction(
        connection,
        new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromSigner.publicKey,
                toPubkey,
                lamports,
            })
        ),
        [fromSigner]
    );
}

export async function generatePayer(connection: web3.Connection, payer: Keypair, lamports?: number) {
    const newPayer = Keypair.generate();
    await transferLamports(connection, payer, newPayer.publicKey, lamports === undefined ? 1000000000 : lamports);
    return newPayer;
}

export async function getOrCreateTokenAccount(connection: Connection, payer: Keypair, mint: PublicKey, owner: PublicKey) {
    const token = getAssociatedTokenAddressSync(mint, owner);
    const tokenData: Account = await getAccount(connection, token).catch((err) => {
        if (err instanceof TokenAccountNotFoundError) {
            return null;
        } else {
            throw err;
        };
    });

    if (tokenData === null) {
        await web3.sendAndConfirmTransaction(
            connection,
            new web3.Transaction().add(
                createAssociatedTokenAccountIdempotentInstruction(
                    payer.publicKey,
                    token,
                    owner,
                    mint,
                )
            ),
            [payer]
        );

        return getAccount(connection, token);
    } else {
        return tokenData;
    }
}