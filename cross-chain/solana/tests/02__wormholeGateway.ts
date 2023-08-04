import { redeemOnSolana, tryNativeToHexString } from "@certusone/wormhole-sdk";
import { MockEthereumTokenBridge } from "@certusone/wormhole-sdk/lib/cjs/mock";
import * as tokenBridge from "@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge";
import * as coreBridge from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { expect } from "chai";
import { WormholeGateway } from "../target/types/wormhole_gateway";
import {
  ETHEREUM_TBTC_ADDRESS,
  ETHEREUM_TOKEN_BRIDGE_ADDRESS,
  GUARDIAN_SET_INDEX,
  CORE_BRIDGE_PROGRAM_ID,
  TOKEN_BRIDGE_PROGRAM_ID,
  TBTC_PROGRAM_ID,
  WORMHOLE_GATEWAY_PROGRAM_ID,
  WRAPPED_TBTC_MINT,
  expectIxFail,
  expectIxSuccess,
  generatePayer,
  getOrCreateAta,
  mockSignAndPostVaa,
  preloadWrappedTbtc,
  ethereumGatewaySendTbtc,
  transferLamports,
  getTokenBridgeSequence,
} from "./helpers";
import * as tbtc from "./helpers/tbtc";
import * as wormholeGateway from "./helpers/wormholeGateway";

async function setup(
  program: Program<WormholeGateway>,
  authority,
  mintingLimit: bigint
) {
  const custodian = wormholeGateway.getCustodianPDA();
  const tbtcMint = tbtc.getTokenPDA();
  const gatewayWrappedTbtcToken = wormholeGateway.getWrappedTbtcTokenPDA();
  const tokenBridgeSender = wormholeGateway.getTokenBridgeSenderPDA();

  await program.methods
    .initialize(new anchor.BN(mintingLimit.toString()))
    .accounts({
      authority: authority.publicKey,
      custodian,
      tbtcMint,
      wrappedTbtcMint: WRAPPED_TBTC_MINT,
      wrappedTbtcToken: gatewayWrappedTbtcToken,
      tokenBridgeSender,
    })
    .rpc();
}

describe("wormhole-gateway", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  // Initialize anchor program.
  const program = anchor.workspace.WormholeGateway as Program<WormholeGateway>;
  const connection = program.provider.connection;

  const custodian = wormholeGateway.getCustodianPDA();
  const tbtcMint = tbtc.getTokenPDA();
  const tbtcConfig = tbtc.getConfigPDA();
  const gatewayWrappedTbtcToken = wormholeGateway.getWrappedTbtcTokenPDA();
  const tokenBridgeSender = wormholeGateway.getTokenBridgeSenderPDA();
  const tokenBridgeRedeemer = wormholeGateway.getTokenBridgeRedeemerPDA();

  const authority = (
    (program.provider as anchor.AnchorProvider).wallet as anchor.Wallet
  ).payer;
  const newAuthority = anchor.web3.Keypair.generate();
  const minterKeys = anchor.web3.Keypair.generate();
  const minter2Keys = anchor.web3.Keypair.generate();
  const impostorKeys = anchor.web3.Keypair.generate();
  const guardianKeys = anchor.web3.Keypair.generate();
  const guardian2Keys = anchor.web3.Keypair.generate();

  const recipientKeys = anchor.web3.Keypair.generate();

  const commonTokenOwner = anchor.web3.Keypair.generate();

  // Mock foreign emitter. 
  const ethereumTokenBridge = new MockEthereumTokenBridge(
    ETHEREUM_TOKEN_BRIDGE_ADDRESS
  );

  it("setup", async () => {
    // Max amount of TBTC that can be minted.
    const mintingLimit = BigInt(10000);

    // Initialize the program.
    await setup(program, authority, mintingLimit);
    await wormholeGateway.checkState(authority.publicKey, mintingLimit);
    await tbtc.checkState(authority, 1, 2, 1500);

    // Also set up common token account.
    await transferLamports(authority, commonTokenOwner.publicKey, 100000000000);
    await getOrCreateAta(
      authority,
      tbtc.getTokenPDA(),
      commonTokenOwner.publicKey
    );
  });

  it("update minting limit", async () => {
    const newLimit = BigInt(20000);
    const ix = await wormholeGateway.updateMintingLimitIx(
      {
        authority: authority.publicKey,
      },
      newLimit
    );
    await expectIxSuccess([ix], [authority]);
    await wormholeGateway.checkState(authority.publicKey, newLimit);
  });

  it("deposit wrapped tokens", async () => {
    const custodian = wormholeGateway.getCustodianPDA();
    
    // Set up new wallet
    const payer = await generatePayer(authority);

    // Check wrapped tBTC mint.
    const recipientWrappedToken = await preloadWrappedTbtc(
      payer,
      ethereumTokenBridge,
      BigInt("100000000000"),
      payer.publicKey
    );

    const recipientToken = await getOrCreateAta(
      payer,
      tbtcMint,
      payer.publicKey
    );
    
    const depositAmount = BigInt(500);

    // Attempt to deposit before the custodian is a minter.
    const ix = await wormholeGateway.depositWormholeTbtcIx(
      {
        recipientWrappedToken,
        recipientToken,
        recipient: payer.publicKey,
      },
      depositAmount
    );
    await expectIxFail([ix], [payer], "AccountNotInitialized");

    // Add custodian as minter.
    await tbtc.addMinter(authority, custodian); 

    // Check token account balances before deposit.
    const [wrappedBefore, tbtcBefore, gatewayBefore] = await Promise.all([
      getAccount(connection, recipientWrappedToken),
      getAccount(connection, recipientToken),
      getAccount(connection, gatewayWrappedTbtcToken),
    ]);

    await expectIxSuccess([ix], [payer]);
    await tbtc.checkState(authority, 2, 2, 2000);

    const [wrappedAfter, tbtcAfter, gatewayAfter] = await Promise.all([
      getAccount(connection, recipientWrappedToken),
      getAccount(connection, recipientToken),
      getAccount(connection, gatewayWrappedTbtcToken),
    ]);

    // Check balance change.
    expect(wrappedAfter.amount).to.equal(wrappedBefore.amount - depositAmount);
    expect(tbtcAfter.amount).to.equal(tbtcBefore.amount + depositAmount);
    expect(gatewayAfter.amount).to.equal(gatewayBefore.amount + depositAmount);

    // Cannot deposit past minting limit.
    const failingIx = await wormholeGateway.depositWormholeTbtcIx(
      {
        recipientWrappedToken,
        recipientToken,
        recipient: payer.publicKey,
      },
      BigInt(50000)
    );
    await expectIxFail([failingIx], [payer], "MintingLimitExceeded");

    // Will succeed if minting limit is increased.
    const newLimit = BigInt(70000);
    const updateLimitIx = await wormholeGateway.updateMintingLimitIx(
      {
        authority: authority.publicKey,
      },
      newLimit
    );
    await expectIxSuccess([updateLimitIx], [authority]);
    await wormholeGateway.checkState(authority.publicKey, newLimit);
    await expectIxSuccess([failingIx], [payer]);
  });

  it("update gateway address", async () => {
    const chain = 2;

    // demonstrate gateway address does not exist
    const gatewayInfo = await connection.getAccountInfo(
      wormholeGateway.getGatewayInfoPDA(chain)
    );
    expect(gatewayInfo).is.null;

    // Make new gateway.
    const firstAddress = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
    const firstIx = await wormholeGateway.updateGatewayAddress(
      {
        authority: authority.publicKey,
      },
      { chain, address: firstAddress }
    );
    await expectIxSuccess([firstIx], [authority]);
    await wormholeGateway.checkGateway(chain, firstAddress);

    // Update gateway.
    const goodAddress = Array.from(ethereumTokenBridge.address);
    const secondIx = await wormholeGateway.updateGatewayAddress(
      {
        authority: authority.publicKey,
      },
      { chain, address: goodAddress }
    );
    await expectIxSuccess([secondIx], [authority]);
    await wormholeGateway.checkGateway(chain, goodAddress);
  });

  it("receive tbtc", async () => {
    // Set up new wallet
    const payer = await generatePayer(authority);

    // Use common token account.
    const recipient = commonTokenOwner.publicKey;
    const recipientToken = getAssociatedTokenAddressSync(
      tbtc.getTokenPDA(),
      recipient
    );

    // Get foreign gateway.
    const fromGateway = await wormholeGateway
      .getGatewayInfo(2)
      .then((info) => info.address);

    const sentAmount = BigInt(5000);
    const signedVaa = await ethereumGatewaySendTbtc(
      payer,
      ethereumTokenBridge,
      sentAmount,
      fromGateway,
      WORMHOLE_GATEWAY_PROGRAM_ID,
      recipient
    );

    const [tbtcBefore, gatewayBefore] = await Promise.all([
      getAccount(connection, recipientToken),
      getAccount(connection, gatewayWrappedTbtcToken),
    ]);

    const ix = await wormholeGateway.receiveTbtcIx(
      {
        payer: payer.publicKey,
        recipientToken,
        recipient,
      },
      signedVaa
    );
    await expectIxSuccess([ix], [payer]);

    const [tbtcAfter, gatewayAfter] = await Promise.all([
      getAccount(connection, recipientToken),
      getAccount(connection, gatewayWrappedTbtcToken),
    ]);

    // TODO: compare balances
  });

  it("send tbtc to gateway", async () => {
    // Use common token account.
    const sender = commonTokenOwner.publicKey;
    const senderToken = getAssociatedTokenAddressSync(
      tbtc.getTokenPDA(),
      sender
    );

    // Check token account.
    const gatewayBefore = await getAccount(connection, gatewayWrappedTbtcToken);

    // Get destination gateway.
    const recipientChain = 2;
    const recipient = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
    const nonce = 420;

    // Try an amount that won't work.
    const badAmount = BigInt(123000);
    const badIx = await wormholeGateway.sendTbtcGatewayIx(
      {
        senderToken,
        sender,
      },
      {
        amount: new anchor.BN(badAmount.toString()),
        recipientChain,
        recipient,
        nonce,
      }
    );
    await expectIxFail([badIx], [commonTokenOwner], "NotEnoughWrappedTbtc");

    // // This should work.
    const goodAmount = BigInt(2000);
    const ix = await wormholeGateway.sendTbtcGatewayIx(
      {
        senderToken,
        sender,
      },
      {
        amount: new anchor.BN(goodAmount.toString()),
        recipientChain,
        recipient,
        nonce,
      }
    );
    await expectIxSuccess([ix], [commonTokenOwner]);
  });

  it("send wrapped tbtc", async () => {
    // Use common token account.
    const sender = commonTokenOwner.publicKey;
    const senderToken = getAssociatedTokenAddressSync(
      tbtc.getTokenPDA(),
      sender
    );

    // Check token account.
    const gatewayBefore = await getAccount(connection, gatewayWrappedTbtcToken);

    // Get destination gateway.
    const recipientChain = 69;
    const recipient = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
    const nonce = 420;

    // // This should work.
    const goodAmount = BigInt(2000);
    const ix = await wormholeGateway.sendTbtcWrappedIx(
      {
        senderToken,
        sender,
      },
      {
        amount: new anchor.BN(goodAmount.toString()),
        recipientChain,
        recipient,
        arbiterFee: new anchor.BN(0),
        nonce,
      }
    );
    await expectIxSuccess([ix], [commonTokenOwner]);
  });
});
