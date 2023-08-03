import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import * as tokenBridge from "@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge";
import * as coreBridge from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { NodeWallet } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { parseTokenTransferVaa, postVaaSolana, redeemOnSolana, tryNativeToHexString } from "@certusone/wormhole-sdk";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { expect } from 'chai';
import { WormholeGateway } from "../target/types/wormhole_gateway";
import { generatePayer, getOrCreateTokenAccount } from "./helpers/utils";
import { web3 } from "@coral-xyz/anchor";

const SOLANA_CORE_BRIDGE_ADDRESS = "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth";
const SOLANA_TOKEN_BRIDGE_ADDRESS = "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb";
const ETHEREUM_TOKEN_BRIDGE_ADDRESS = "0x3ee18B2214AFF97000D974cf647E7C347E8fa585";
const ETHEREUM_TBTC_ADDRESS = "0x18084fbA666a33d37592fA2633fD49a74DD93a88";

const GUARDIAN_SET_INDEX = 3;

function getCustodianPDA(
  program: Program<WormholeGateway>,
): [anchor.web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from('custodian'),
    ],
    program.programId
  );
}


describe("wormhole-gateway", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.WormholeGateway as Program<WormholeGateway>;
  const connection = program.provider.connection;

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
    // await setup(program, authority);
    // await checkState(program, authority, 0, 0, 0);
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
