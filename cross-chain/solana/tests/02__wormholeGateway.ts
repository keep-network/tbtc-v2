import { redeemOnSolana, tryNativeToHexString } from "@certusone/wormhole-sdk";
import { MockEthereumTokenBridge } from "@certusone/wormhole-sdk/lib/cjs/mock";
import * as tokenBridge from "@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge";
import * as coreBridge from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program, web3 } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { expect } from "chai";
import { Tbtc } from "../target/types/tbtc";
import { WormholeGateway } from "../target/types/wormhole_gateway";
import {
  ETHEREUM_TBTC_ADDRESS,
  ETHEREUM_TOKEN_BRIDGE_ADDRESS,
  GUARDIAN_SET_INDEX,
  SOLANA_CORE_BRIDGE_ADDRESS,
  SOLANA_TOKEN_BRIDGE_ADDRESS,
  WRAPPED_TBTC_MINT,
  generatePayer,
  getOrCreateTokenAccount,
  mockSignAndPostVaa,
  preloadWrappedTbtc,
} from "./helpers";
import * as tbtc from "./helpers/tbtc";
import {
  getCustodianPDA,
  getTokenBridgeRedeemerPDA,
  getTokenBridgeSenderPDA,
  getWrappedTbtcTokenPDA,
} from "./helpers/wormholeGateway";

async function setup(
  program: Program<WormholeGateway>,
  tbtcProgram: Program<Tbtc>,
  authority,
  mintingLimit: number
) {
  const custodian = getCustodianPDA();
  const tbtcMint = tbtc.getTokenPDA();
  const gatewayWrappedTbtcToken = getWrappedTbtcTokenPDA();
  const tokenBridgeSender = getTokenBridgeSenderPDA();
  const tokenBridgeRedeemer = getTokenBridgeRedeemerPDA();

  const wrappedTbtcMint = tokenBridge.deriveWrappedMintKey(
    SOLANA_TOKEN_BRIDGE_ADDRESS,
    2,
    ETHEREUM_TBTC_ADDRESS
  );

  await program.methods
    .initialize(new anchor.BN(mintingLimit))
    .accounts({
      authority: authority.publicKey,
      custodian,
      tbtcMint,
      wrappedTbtcMint,
      wrappedTbtcToken: gatewayWrappedTbtcToken,
      tokenBridgeSender,
      tokenBridgeRedeemer,
    })
    .rpc();
}

async function checkState(
  program: Program<WormholeGateway>,
  expectedAuthority,
  expectedMintingLimit
  // expectedMintedAmount,
) {
  const custodian = getCustodianPDA();
  let custodianState = await program.account.custodian.fetch(custodian);

  expect(custodianState.mintingLimit.eq(new anchor.BN(expectedMintingLimit))).to
    .be.true;
  expect(custodianState.authority).to.eql(expectedAuthority.publicKey);
}

describe("wormhole-gateway", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.WormholeGateway as Program<WormholeGateway>;
  const connection = program.provider.connection;

  const tbtcProgram = anchor.workspace.Tbtc as Program<Tbtc>;

  const custodian = getCustodianPDA();
  const tbtcMint = tbtc.getTokenPDA();
  const tbtcConfig = tbtc.getConfigPDA();
  const gatewayWrappedTbtcToken = getWrappedTbtcTokenPDA();
  const tokenBridgeSender = getTokenBridgeSenderPDA();
  const tokenBridgeRedeemer = getTokenBridgeRedeemerPDA();

  const authority = (program.provider as anchor.AnchorProvider)
    .wallet as anchor.Wallet;
  const newAuthority = anchor.web3.Keypair.generate();
  const minterKeys = anchor.web3.Keypair.generate();
  const minter2Keys = anchor.web3.Keypair.generate();
  const impostorKeys = anchor.web3.Keypair.generate();
  const guardianKeys = anchor.web3.Keypair.generate();
  const guardian2Keys = anchor.web3.Keypair.generate();

  const recipientKeys = anchor.web3.Keypair.generate();

  const ethereumTokenBridge = new MockEthereumTokenBridge(
    ETHEREUM_TOKEN_BRIDGE_ADDRESS
  );

  it("check core bridge and token bridge", async () => {
    // Check core bridge guardian set.
    const guardianSetData = await coreBridge.getGuardianSet(
      connection,
      SOLANA_CORE_BRIDGE_ADDRESS,
      GUARDIAN_SET_INDEX
    );
    expect(guardianSetData.keys).has.length(1);

    // Set up new wallet
    const payer = await generatePayer(connection, authority.payer);

    // Check wrapped tBTC mint.
    const wrappedTbtcMint = tokenBridge.deriveWrappedMintKey(
      SOLANA_TOKEN_BRIDGE_ADDRESS,
      2,
      ETHEREUM_TBTC_ADDRESS
    );
    const mintData = await getMint(connection, wrappedTbtcMint);
    expect(mintData.decimals).to.equal(8);
    expect(mintData.supply).to.equal(BigInt(90));

    const wrappedTbtcToken = await getOrCreateTokenAccount(
      connection,
      payer,
      wrappedTbtcMint,
      payer.publicKey
    );

    // Bridge tbtc to token account.
    const published = ethereumTokenBridge.publishTransferTokens(
      tryNativeToHexString(ETHEREUM_TBTC_ADDRESS, "ethereum"),
      2,
      BigInt("100000000000"),
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
  });

  it("setup", async () => {
    await setup(program, tbtcProgram, authority, 10000);
    await checkState(program, authority, 10000);
    await tbtc.checkState(authority, 1, 2, 1500);
  });

  it("update minting limit", async () => {
    await program.methods
      .updateMintingLimit(new anchor.BN(20000))
      .accounts({
        custodian,
        authority: authority.publicKey,
      })
      .rpc();
    await checkState(program, authority, 20000);
  });

  it("deposit wrapped tokens", async () => {
    const custodian = getCustodianPDA();
    const minterInfo = await tbtc.addMinter(authority, custodian);

    // Set up new wallet
    const payer = await generatePayer(connection, authority.payer);

    // Check wrapped tBTC mint.
    const wrappedTbtcToken = await preloadWrappedTbtc(
      connection,
      payer,
      ethereumTokenBridge,
      BigInt("100000000000"),
      payer.publicKey
    );

    const recipientToken = await getOrCreateTokenAccount(
      connection,
      payer,
      tbtcMint,
      payer.publicKey
    );

    await program.methods
      .depositWormholeTbtc(new anchor.BN(500))
      .accounts({
        custodian,
        wrappedTbtcToken: gatewayWrappedTbtcToken,
        wrappedTbtcMint: WRAPPED_TBTC_MINT,
        tbtcMint,
        recipientWrappedToken: wrappedTbtcToken,
        recipientToken: recipientToken.address,
        recipient: payer.publicKey,
        tbtcConfig,
        minterInfo,
        tbtcProgram: tbtcProgram.programId,
      })
      .signers(tbtc.maybeAuthorityAnd(payer, []))
      .rpc();

    await tbtc.checkState(authority, 2, 2, 2000);

    try {
      await program.methods
        .depositWormholeTbtc(new anchor.BN(50000))
        .accounts({
          custodian,
          wrappedTbtcToken: gatewayWrappedTbtcToken,
          wrappedTbtcMint: WRAPPED_TBTC_MINT,
          tbtcMint,
          recipientWrappedToken: wrappedTbtcToken,
          recipientToken: recipientToken.address,
          recipient: payer.publicKey,
          tbtcConfig,
          minterInfo,
          tbtcProgram: tbtcProgram.programId,
        })
        .signers(tbtc.maybeAuthorityAnd(payer, []))
        .rpc();
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal("MintingLimitExceeded");
      expect(err.program.equals(program.programId)).is.true;
    }
  });
});
