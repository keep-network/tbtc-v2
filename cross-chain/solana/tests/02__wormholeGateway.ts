import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import * as tokenBridge from "@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge";
import * as coreBridge from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { NodeWallet } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { parseTokenTransferVaa, postVaaSolana, redeemOnSolana, tryNativeToHexString } from "@certusone/wormhole-sdk";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { expect } from 'chai';
import { WormholeGateway } from "../target/types/wormhole_gateway";
import { generatePayer, getOrCreateTokenAccount } from "./helpers/utils";
import { getCustodianPDA, getTokenBridgeRedeemerPDA, getTokenBridgeSenderPDA, getWrappedTbtcTokenPDA } from "./helpers/wormholeGatewayHelpers";
import * as tbtc from "./helpers/tbtcHelpers";
import { web3 } from "@coral-xyz/anchor";
import { Tbtc } from "../target/types/tbtc";

const SOLANA_CORE_BRIDGE_ADDRESS = "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth";
const SOLANA_TOKEN_BRIDGE_ADDRESS = "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb";
const ETHEREUM_TOKEN_BRIDGE_ADDRESS = "0x3ee18B2214AFF97000D974cf647E7C347E8fa585";
const ETHEREUM_TBTC_ADDRESS = "0x18084fbA666a33d37592fA2633fD49a74DD93a88";

const GUARDIAN_SET_INDEX = 3;


async function setup(
  program: Program<WormholeGateway>,
  tbtcProgram: Program<Tbtc>,
  authority,
  mintingLimit: number
) {
  const [custodian,] = getCustodianPDA(program);
  const [tbtcMint,] = tbtc.getTokenPDA(tbtcProgram);
  const [gatewayWrappedTbtcToken,] = getWrappedTbtcTokenPDA(program);
  const [tokenBridgeSender,] = getTokenBridgeSenderPDA(program);
  const [tokenBridgeRedeemer,] = getTokenBridgeRedeemerPDA(program);

  const wrappedTbtcMint = tokenBridge.deriveWrappedMintKey(SOLANA_TOKEN_BRIDGE_ADDRESS, 2, ETHEREUM_TBTC_ADDRESS);
  
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
  expectedMintingLimit,
  // expectedMintedAmount,
) {
  const [custodian,] = getCustodianPDA(program);
  let custodianState = await program.account.custodian.fetch(custodian);

  expect(custodianState.mintingLimit.eq(new anchor.BN(expectedMintingLimit))).to.be.true;
  expect(custodianState.authority).to.eql(expectedAuthority.publicKey);
}

describe("wormhole-gateway", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.WormholeGateway as Program<WormholeGateway>;
  const connection = program.provider.connection;

  const tbtcProgram = anchor.workspace.Tbtc as Program<Tbtc>;

  const [custodian,] = getCustodianPDA(program);
  const [tbtcMint,] = tbtc.getTokenPDA(tbtcProgram);
  const [tbtcConfig,] = tbtc.getConfigPDA(tbtcProgram);
  const [gatewayWrappedTbtcToken,] = getWrappedTbtcTokenPDA(program);
  const [tokenBridgeSender,] = getTokenBridgeSenderPDA(program);
  const [tokenBridgeRedeemer,] = getTokenBridgeRedeemerPDA(program);

  const authority = (program.provider as anchor.AnchorProvider).wallet as anchor.Wallet;
  const newAuthority = anchor.web3.Keypair.generate();
  const minterKeys = anchor.web3.Keypair.generate();
  const minter2Keys = anchor.web3.Keypair.generate();
  const impostorKeys = anchor.web3.Keypair.generate();
  const guardianKeys = anchor.web3.Keypair.generate();
  const guardian2Keys = anchor.web3.Keypair.generate();

  const recipientKeys = anchor.web3.Keypair.generate();

  const ethereumTokenBridge = new mock.MockEthereumTokenBridge(ETHEREUM_TOKEN_BRIDGE_ADDRESS);

  it('check core bridge and token bridge', async () => {
    // Check core bridge guardian set.
    const guardianSetData = await coreBridge.getGuardianSet(connection, SOLANA_CORE_BRIDGE_ADDRESS, GUARDIAN_SET_INDEX);
    expect(guardianSetData.keys).has.length(1);

    // Set up new wallet
    const payer = await generatePayer(connection, authority.payer);

    // Check wrapped tBTC mint.
    const wrappedTbtcMint = tokenBridge.deriveWrappedMintKey(SOLANA_TOKEN_BRIDGE_ADDRESS, 2, ETHEREUM_TBTC_ADDRESS);
    const mintData = await spl.getMint(connection, wrappedTbtcMint);
    expect(mintData.decimals).to.equal(8);
    expect(mintData.supply).to.equal(BigInt(90));

    const wrappedTbtcToken = await getOrCreateTokenAccount(connection, payer, wrappedTbtcMint, payer.publicKey);

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
      signedVaa,
    );
    await web3.sendAndConfirmTransaction(connection, tx, [payer]);
  });

  it('setup', async () => {
    await setup(program, tbtcProgram, authority, 10000);
    await checkState(program, authority, 10000);
    await tbtc.checkState(tbtcProgram, authority, 1, 2, 1500);
  });

  it('update minting limit', async () => {
    await program.methods
      .updateMintingLimit(new anchor.BN(20000))
      .accounts({
        custodian,
        authority: authority.publicKey
      })
      .rpc();
    await checkState(program, authority, 20000);
  });

  it('deposit wrapped tokens', async () => {
    const [custodian,] = getCustodianPDA(program);
    const minterInfo = await tbtc.addMinter(tbtcProgram, authority, custodian);

    // Set up new wallet
    const payer = await generatePayer(connection, authority.payer);

    // Check wrapped tBTC mint.
    const wrappedTbtcMint = tokenBridge.deriveWrappedMintKey(SOLANA_TOKEN_BRIDGE_ADDRESS, 2, ETHEREUM_TBTC_ADDRESS);
    const wrappedTbtcToken = await getOrCreateTokenAccount(connection, payer, wrappedTbtcMint, payer.publicKey);

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
      signedVaa,
    );
    await web3.sendAndConfirmTransaction(connection, tx, [payer]);

    const recipientToken = await getOrCreateTokenAccount(connection, payer, tbtcMint, payer.publicKey);

    await program.methods
      .depositWormholeTbtc(new anchor.BN(500))
      .accounts({
        custodian,
        wrappedTbtcToken: gatewayWrappedTbtcToken,
        wrappedTbtcMint,
        tbtcMint,
        recipientWrappedToken: wrappedTbtcToken.address,
        recipientToken: recipientToken.address,
        recipient: payer.publicKey,
        tbtcConfig,
        minterInfo,
        tbtcProgram: tbtcProgram.programId,
      })
      .signers(tbtc.maybeAuthorityAnd(payer, []))
      .rpc();

    await tbtc.checkState(tbtcProgram, authority, 2, 2, 2000);

    try {
      await program.methods
      .depositWormholeTbtc(new anchor.BN(50000))
      .accounts({
        custodian,
        wrappedTbtcToken: gatewayWrappedTbtcToken,
        wrappedTbtcMint,
        tbtcMint,
        recipientWrappedToken: wrappedTbtcToken.address,
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
      expect(err.error.errorCode.code).to.equal('MintingLimitExceeded');
      expect(err.program.equals(program.programId)).is.true;
    }
  });
});

async function mockSignAndPostVaa(connection: web3.Connection, payer: web3.Keypair, published: Buffer) {
  const guardians = new mock.MockGuardians(
    GUARDIAN_SET_INDEX,
    ["cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0"]
  );

  // Add guardian signature.
  const signedVaa = guardians.addSignatures(published, [0]);

  // Verify and post VAA.
  await postVaaSolana(connection,
    new NodeWallet(payer).signTransaction,
    SOLANA_CORE_BRIDGE_ADDRESS,
    payer.publicKey,
    signedVaa
  );

  return signedVaa;
}
