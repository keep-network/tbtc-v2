import {
  MockEthereumTokenBridge,
  MockGuardians,
} from "@certusone/wormhole-sdk/lib/cjs/mock";
import { web3 } from "@coral-xyz/anchor";
import {
  Account,
  TokenAccountNotFoundError,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ETHEREUM_TBTC_ADDRESS,
  GUARDIAN_SET_INDEX,
  SOLANA_CORE_BRIDGE_ADDRESS,
  SOLANA_TOKEN_BRIDGE_ADDRESS,
  WRAPPED_TBTC_MINT,
} from "./consts";
import {
  postVaaSolana,
  redeemOnSolana,
  tryNativeToHexString,
} from "@certusone/wormhole-sdk";
import { NodeWallet } from "@certusone/wormhole-sdk/lib/cjs/solana";

export async function transferLamports(
  connection: web3.Connection,
  fromSigner: web3.Keypair,
  toPubkey: web3.PublicKey,
  lamports: number
) {
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

export async function generatePayer(
  connection: web3.Connection,
  payer: Keypair,
  lamports?: number
) {
  const newPayer = Keypair.generate();
  await transferLamports(
    connection,
    payer,
    newPayer.publicKey,
    lamports === undefined ? 1000000000 : lamports
  );
  return newPayer;
}

export async function getOrCreateTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
) {
  const token = getAssociatedTokenAddressSync(mint, owner);
  const tokenData: Account = await getAccount(connection, token).catch(
    (err) => {
      if (err instanceof TokenAccountNotFoundError) {
        return null;
      } else {
        throw err;
      }
    }
  );

  if (tokenData === null) {
    await web3.sendAndConfirmTransaction(
      connection,
      new web3.Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          token,
          owner,
          mint
        )
      ),
      [payer]
    );

    return getAccount(connection, token);
  } else {
    return tokenData;
  }
}

export async function preloadWrappedTbtc(
  connection: Connection,
  payer: Keypair,
  ethereumTokenBridge: MockEthereumTokenBridge,
  amount: bigint,
  tokenOwner: PublicKey
) {
  const wrappedTbtcToken = await getOrCreateTokenAccount(
    connection,
    payer,
    WRAPPED_TBTC_MINT,
    tokenOwner
  );

  // Bridge tbtc to token account.
  const published = ethereumTokenBridge.publishTransferTokens(
    tryNativeToHexString(ETHEREUM_TBTC_ADDRESS, "ethereum"),
    2,
    amount,
    1,
    wrappedTbtcToken.address.toBuffer().toString("hex"),
    BigInt(0),
    0,
    0
  );

  const signedVaa = await mockSignAndPostVaa(connection, payer, published);

  const tx = await redeemOnSolana(
    connection,
    SOLANA_CORE_BRIDGE_ADDRESS,
    SOLANA_TOKEN_BRIDGE_ADDRESS,
    payer.publicKey,
    signedVaa
  );
  await web3.sendAndConfirmTransaction(connection, tx, [payer]);

  return wrappedTbtcToken.address;
}

export async function mockSignAndPostVaa(
  connection: web3.Connection,
  payer: web3.Keypair,
  published: Buffer
) {
  const guardians = new MockGuardians(GUARDIAN_SET_INDEX, [
    "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0",
  ]);

  // Add guardian signature.
  const signedVaa = guardians.addSignatures(published, [0]);

  // Verify and post VAA.
  await postVaaSolana(
    connection,
    new NodeWallet(payer).signTransaction,
    SOLANA_CORE_BRIDGE_ADDRESS,
    payer.publicKey,
    signedVaa
  );

  return signedVaa;
}

// export function ethereumGatewaySendTbtc(
//   ethereumTokenBridge: MockEthereumTokenBridge,
//   amount: bigint,
//   recipient: Buffer
// ) {
//   const wrappedTbtcMint = getWrappedTbtcMintPDA();
//   const custodianWrappedTbtcToken = getWrappedTbtcTokenPDA;
//   const published = ethereumTokenBridge.publishTransferTokens(
//     tryNativeToHexString(ETHEREUM_TBTC_ADDRESS, "ethereum"),
//     2,
//     BigInt("100000000000"),
//     1,
//     wrappedTbtcToken.address.toBuffer().toString("hex"),
//     BigInt(0),
//     0,
//     0
//   );

//   const guardians = new mock.MockGuardians(GUARDIAN_SET_INDEX, [
//     "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0",
//   ]);

//   // Add guardian signature.
//   const signedVaa = guardians.addSignatures(published, [0]);
// }
