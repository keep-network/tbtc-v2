import {
  MockEthereumTokenBridge,
  MockGuardians,
} from "@certusone/wormhole-sdk/lib/cjs/mock";
import { Idl, Program, web3, workspace } from "@coral-xyz/anchor";
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
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ETHEREUM_TBTC_ADDRESS,
  GUARDIAN_SET_INDEX,
  CORE_BRIDGE_PROGRAM_ID,
  TOKEN_BRIDGE_PROGRAM_ID,
  WRAPPED_TBTC_MINT,
  GUARDIAN_DEVNET_PRIVATE_KEYS,
} from "./consts";
import {
  postVaaSolana,
  redeemOnSolana,
  tryNativeToHexString,
} from "@certusone/wormhole-sdk";
import { NodeWallet } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { expect } from "chai";
import * as coreBridge from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";

export async function transferLamports<T extends Idl>(
  fromSigner: web3.Keypair,
  toPubkey: web3.PublicKey,
  lamports: number
) {
  const program = workspace.WormholeGateway as Program<T>;
  return sendAndConfirmTransaction(
    program.provider.connection,
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

export async function generatePayer<T extends Idl>(
  funder: Keypair,
  lamports?: number
) {
  const newPayer = Keypair.generate();
  await transferLamports<T>(
    funder,
    newPayer.publicKey,
    lamports === undefined ? 1000000000 : lamports
  );
  return newPayer;
}

export async function getOrCreateAta<T extends Idl>(
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
) {
  const program = workspace.WormholeGateway as Program<T>;
  const connection = program.provider.connection;

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
  }

  return token;
}

export async function preloadWrappedTbtc<T extends Idl>(
  payer: Keypair,
  ethereumTokenBridge: MockEthereumTokenBridge,
  amount: bigint,
  tokenOwner: PublicKey
) {
  const program = workspace.WormholeGateway as Program<T>;
  const connection = program.provider.connection;

  const wrappedTbtcToken = await getOrCreateAta<T>(
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
    wrappedTbtcToken.toBuffer().toString("hex"),
    BigInt(0),
    0,
    0
  );

  const signedVaa = await mockSignAndPostVaa(payer, published);

  const tx = await redeemOnSolana(
    connection,
    CORE_BRIDGE_PROGRAM_ID,
    TOKEN_BRIDGE_PROGRAM_ID,
    payer.publicKey,
    signedVaa
  );
  await web3.sendAndConfirmTransaction(connection, tx, [payer]);

  return wrappedTbtcToken;
}

export async function mockSignAndPostVaa<T extends Idl>(
  payer: web3.Keypair,
  published: Buffer
) {
  const program = workspace.WormholeGateway as Program<T>;

  const guardians = new MockGuardians(GUARDIAN_SET_INDEX, [
    "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0",
  ]);

  // Add guardian signature.
  const signedVaa = guardians.addSignatures(published, [0]);

  // Verify and post VAA.
  await postVaaSolana(
    program.provider.connection,
    new NodeWallet(payer).signTransaction,
    CORE_BRIDGE_PROGRAM_ID,
    payer.publicKey,
    signedVaa
  );

  return signedVaa;
}

export async function ethereumGatewaySendTbtc<T extends Idl>(
  payer: web3.Keypair,
  ethereumTokenBridge: MockEthereumTokenBridge,
  amount: bigint,
  fromGateway: number[],
  toGateway: PublicKey,
  recipient: PublicKey,
  tokenAddress?: string,
  tokenChain?: number
) {
  const program = workspace.WormholeGateway as Program<T>;

  const published = ethereumTokenBridge.publishTransferTokensWithPayload(
    tryNativeToHexString(tokenAddress ?? ETHEREUM_TBTC_ADDRESS, "ethereum"),
    tokenChain ?? 2,
    amount,
    1,
    toGateway.toBuffer().toString("hex"),
    Buffer.from(fromGateway),
    recipient.toBuffer(),
    0,
    0
  );

  const guardians = new MockGuardians(
    GUARDIAN_SET_INDEX,
    GUARDIAN_DEVNET_PRIVATE_KEYS
  );

  // Add guardian signature.
  const signedVaa = guardians.addSignatures(published, [0]);

  // Verify and post VAA.
  await postVaaSolana(
    program.provider.connection,
    new NodeWallet(payer).signTransaction,
    CORE_BRIDGE_PROGRAM_ID,
    payer.publicKey,
    signedVaa
  );

  return signedVaa;
}

export async function expectIxSuccess<T extends Idl>(
  ixes: TransactionInstruction[],
  signers: Keypair[]
) {
  const program = workspace.WormholeGateway as Program<T>;
  await sendAndConfirmTransaction(
    program.provider.connection,
    new Transaction().add(...ixes),
    signers
  ).catch((err) => {
    console.log(err.logs);
    throw err;
  });
}

export async function expectIxFail<T extends Idl>(
  ixes: TransactionInstruction[],
  signers: Keypair[],
  errorMessage: string
) {
  const program = workspace.WormholeGateway as Program<T>;
  try {
    const txSig = await sendAndConfirmTransaction(
      program.provider.connection,
      new Transaction().add(...ixes),
      signers
    );
    chai.assert(false, `transaction should have failed: ${txSig}`);
  } catch (err) {
    const logs: string[] = err.logs;
    expect(logs.join("\n")).includes(errorMessage);
  }
}

export function getTokenBridgeCoreEmitter() {
  const [tokenBridgeCoreEmitter] = PublicKey.findProgramAddressSync(
    [Buffer.from("emitter")],
    TOKEN_BRIDGE_PROGRAM_ID
  );

  return tokenBridgeCoreEmitter;
}

export async function getTokenBridgeSequence<T extends Idl>() {
  const program = workspace.WormholeGateway as Program<T>;
  const emitter = getTokenBridgeCoreEmitter();
  return coreBridge
    .getSequenceTracker(
      program.provider.connection,
      emitter,
      CORE_BRIDGE_PROGRAM_ID
    )
    .then((tracker) => tracker.sequence);
}
