import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import * as tokenBridge from "@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge";
import * as coreBridge from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { parseTokenTransferVaa, postVaaSolana, redeemOnSolana, tryNativeToHexString } from "@certusone/wormhole-sdk";

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import * as web3 from '@solana/web3.js';
import { expect } from 'chai';

import { WormholeGateway } from "../target/types/wormhole_gateway";

import { generatePayer, getOrCreateTokenAccount } from "./helpers/utils";
import {
  getCustodianPDA,
  getTokenBridgeRedeemerPDA,
  getTokenBridgeSenderPDA,
  getWrappedTbtcTokenPDA,
  mockSignAndPostVaa
} from "./helpers/wormholeGatewayHelpers";
import * as tbtc from "./helpers/tbtcHelpers";
import { Tbtc } from "../target/types/tbtc";

const SOLANA_CORE_BRIDGE_ADDRESS = "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth";
const SOLANA_TOKEN_BRIDGE_ADDRESS = "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb";
const ETHEREUM_TOKEN_BRIDGE_ADDRESS = "0x3ee18B2214AFF97000D974cf647E7C347E8fa585";
const ETHEREUM_TBTC_ADDRESS = "0x18084fbA666a33d37592fA2633fD49a74DD93a88";

const GUARDIAN_SET_INDEX = 3;


export async function setupGateway(
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

export async function checkCustodianState(
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

export async function bridgeToSolana(
  amount,
  connection,
  payer,
  ethereumTokenBridge,
): Promise<spl.Account> {
  const wrappedTbtcMint = tokenBridge.deriveWrappedMintKey(SOLANA_TOKEN_BRIDGE_ADDRESS, 2, ETHEREUM_TBTC_ADDRESS);
  const wrappedTbtcToken = await getOrCreateTokenAccount(connection, payer, wrappedTbtcMint, payer.publicKey);

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
      signedVaa,
  );
  await web3.sendAndConfirmTransaction(connection, tx, [payer]);
  return wrappedTbtcToken;
}

export async function depositWormholeTbtc(
  program: Program<WormholeGateway>,
  tbtcProgram,
  amount,
  recipientWrappedToken,
  recipientToken,
  payer,
  minterInfo,
) {
  const [custodian,] = getCustodianPDA(program);
  const [tbtcMint,] = tbtc.getTokenPDA(tbtcProgram);
  const [tbtcConfig,] = tbtc.getConfigPDA(tbtcProgram);
  const [wrappedTbtcToken,] = getWrappedTbtcTokenPDA(program);
  const wrappedTbtcMint = tokenBridge.deriveWrappedMintKey(SOLANA_TOKEN_BRIDGE_ADDRESS, 2, ETHEREUM_TBTC_ADDRESS);

  await program.methods
      .depositWormholeTbtc(new anchor.BN(amount))
      .accounts({
          custodian,
          wrappedTbtcToken,
          wrappedTbtcMint,
          tbtcMint,
          recipientWrappedToken,
          recipientToken,
          recipient: payer.publicKey,
          tbtcConfig,
          minterInfo,
          tbtcProgram: tbtcProgram.programId,
      })
      .signers(tbtc.maybeAuthorityAnd(payer, []))
      .rpc();
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

  const wrappedTbtcMint = tokenBridge.deriveWrappedMintKey(SOLANA_TOKEN_BRIDGE_ADDRESS, 2, ETHEREUM_TBTC_ADDRESS);

  it('check core bridge and token bridge', async () => {
    // Check core bridge guardian set.
    const guardianSetData = await coreBridge.getGuardianSet(connection, SOLANA_CORE_BRIDGE_ADDRESS, GUARDIAN_SET_INDEX);
    expect(guardianSetData.keys).has.length(1);

    // Set up new wallet
    const payer = await generatePayer(connection, authority.payer);

    // Check wrapped tBTC mint.
    const mintData = await spl.getMint(connection, wrappedTbtcMint);
    expect(mintData.decimals).to.equal(8);
    expect(mintData.supply).to.equal(BigInt(90));

    await bridgeToSolana(BigInt("100000000000"), connection, payer, ethereumTokenBridge);
  });

  it('setup', async () => {
    await setupGateway(program, tbtcProgram, authority, 10000);
    await checkCustodianState(program, authority, 10000);
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
    await checkCustodianState(program, authority, 20000);
  });

  it('deposit wrapped tokens', async () => {
    // Set up new wallet
    const payer = await generatePayer(connection, authority.payer);
    const minterInfo = await tbtc.addMinter(tbtcProgram, authority, custodian);
    const wrappedTbtcToken = await bridgeToSolana(BigInt("100000000000"), connection, payer, ethereumTokenBridge);
    const recipientToken = await getOrCreateTokenAccount(connection, payer, tbtcMint, payer.publicKey);
    
    await depositWormholeTbtc(
      program,
      tbtcProgram,
      500,
      wrappedTbtcToken.address,
      recipientToken.address,
      payer,
      minterInfo
    );
  
    await tbtc.checkState(tbtcProgram, authority, 2, 2, 2000);
  });

  it('- won\'t deposit wrapped tokens over the minting limit', async () => {
    const minterInfo = tbtc.getMinterPDA(tbtcProgram, custodian)[0];
    const payer = await generatePayer(connection, authority.payer);
    const wrappedTbtcToken = await bridgeToSolana(BigInt("100000000000"), connection, payer, ethereumTokenBridge);
    const recipientToken = await getOrCreateTokenAccount(connection, payer, tbtcMint, payer.publicKey);

    try {
      await depositWormholeTbtc(
        program,
        tbtcProgram,
        50000,
        wrappedTbtcToken.address,
        recipientToken.address,
        payer,
        minterInfo
      );
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('MintingLimitExceeded');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('- won\'t deposit wrapped tokens with mismatched token types', async () => {
    const minterInfo = tbtc.getMinterPDA(tbtcProgram, custodian)[0];
    const payer = await generatePayer(connection, authority.payer);
    const wrappedTbtcToken = await bridgeToSolana(BigInt("100000000000"), connection, payer, ethereumTokenBridge);
    const recipientToken = await getOrCreateTokenAccount(connection, payer, tbtcMint, payer.publicKey);

    try {
      await depositWormholeTbtc(
        program,
        tbtcProgram,
        500,
        recipientToken.address,
        recipientToken.address,
        payer,
        minterInfo
      );
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintTokenMint');
      expect(err.program.equals(program.programId)).is.true;
    }
    try {
      await depositWormholeTbtc(
        program,
        tbtcProgram,
        500,
        wrappedTbtcToken.address,
        wrappedTbtcToken.address,
        payer,
        minterInfo
      );
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintTokenMint');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('- won\'t deposit wrapped tokens to wrong owner', async () => {
    const minterInfo = tbtc.getMinterPDA(tbtcProgram, custodian)[0];
    const payer = await generatePayer(connection, authority.payer);
    const payer2 = await generatePayer(connection, authority.payer);
    const wrappedTbtcToken = await bridgeToSolana(BigInt("100000000000"), connection, payer, ethereumTokenBridge);
    const recipientToken = await getOrCreateTokenAccount(connection, payer, tbtcMint, payer.publicKey);
    const wrappedTbtcToken2 = await bridgeToSolana(BigInt("100"), connection, payer2, ethereumTokenBridge);
    const recipient2Token = await getOrCreateTokenAccount(connection, payer, tbtcMint, payer2.publicKey);

    try {
      await depositWormholeTbtc(
        program,
        tbtcProgram,
        50000,
        wrappedTbtcToken.address,
        recipient2Token.address,
        payer,
        minterInfo
      );
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintTokenOwner');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('- won\'t deposit wrapped tokens from wrong owner', async () => {
    const minterInfo = tbtc.getMinterPDA(tbtcProgram, custodian)[0];
    const payer = await generatePayer(connection, authority.payer);
    const payer2 = await generatePayer(connection, authority.payer);
    const wrappedTbtcToken = await bridgeToSolana(BigInt("100000000000"), connection, payer, ethereumTokenBridge);
    const recipientToken = await getOrCreateTokenAccount(connection, payer, tbtcMint, payer.publicKey);
    const wrappedTbtcToken2 = await bridgeToSolana(BigInt("100"), connection, payer2, ethereumTokenBridge);
    const recipient2Token = await getOrCreateTokenAccount(connection, payer, tbtcMint, payer2.publicKey);

    try {
      await depositWormholeTbtc(
        program,
        tbtcProgram,
        50000,
        wrappedTbtcToken2.address,
        recipientToken.address,
        payer,
        minterInfo
      );
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintTokenOwner');
      expect(err.program.equals(program.programId)).is.true;
    }
  });
});
