import * as anchor from "@coral-xyz/anchor"
import fs from "fs"
import { PublicKey, Keypair } from "@solana/web3.js"
import dotenv from "dotenv"
import { Program } from "@coral-xyz/anchor";
import { Tbtc } from "../target/types/tbtc";
import { WormholeGateway } from "../target/types/wormhole_gateway";
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

async function run(): Promise<void> {
  dotenv.config({ path: "../solana.env" })

  anchor.setProvider(anchor.AnchorProvider.env());

  const tbtcProgram = anchor.workspace.Tbtc as Program<Tbtc>;
  const wormholeGatewayProgram = anchor.workspace.WormholeGateway as Program<WormholeGateway>;

  console.log("tbtcProgram.programId", tbtcProgram.programId)
  console.log("wormholeGatewayProgram.programId", wormholeGatewayProgram.programId)

  // This wallet deployed the program and is also an authority
  const authority = (loadKey(process.env.AUTHORITY)).publicKey

  const mint = PublicKey.findProgramAddressSync(
    [Buffer.from("tbtc-mint")],
    tbtcProgram.programId
  )[0];

  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    tbtcProgram.programId
  )[0];

  const guardians = PublicKey.findProgramAddressSync(
    [Buffer.from("guardians")],
    tbtcProgram.programId
  )[0];

  const minters = PublicKey.findProgramAddressSync(
    [Buffer.from("minters")],
    tbtcProgram.programId
  )[0];

  const tbtcMetadata = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  )[0];

  const mplTokenMetadataProgram = METADATA_PROGRAM_ID;

  // Initalize tbtc program
  await tbtcProgram.methods
    .initialize()
    .accounts({
      mint,
      config,
      guardians,
      minters,
      authority,
      tbtcMetadata,
      mplTokenMetadataProgram
    })
    .instruction()

  const minter = PublicKey.findProgramAddressSync(
    [Buffer.from("redeemer")],
    wormholeGatewayProgram.programId
  )[0]

  const mintingLimit = 10000 // Arbitrary big number of TBTC
  // TODO: verify with WH team if the address is correct
  const WRAPPED_TBTC_MINT = new PublicKey(
    "25rXTx9zDZcHyTav5sRqM6YBvTGu9pPH9yv83uAEqbgG"
  );

  const gatewayWrappedTbtcToken = PublicKey.findProgramAddressSync(
    [Buffer.from("wrapped-token")],
    wormholeGatewayProgram.programId
  )[0]

  const tokenBridgeSender = PublicKey.findProgramAddressSync(
    [Buffer.from("sender")],
    wormholeGatewayProgram.programId
  )[0]

  await wormholeGatewayProgram.methods
    .initialize(new anchor.BN(mintingLimit))
    .accounts({
      authority,
      custodian: minter,
      tbtcMint: mint,
      wrappedTbtcMint: WRAPPED_TBTC_MINT,
      wrappedTbtcToken: gatewayWrappedTbtcToken,
      tokenBridgeSender,
    })
    .rpc();

  const minterInfo = PublicKey.findProgramAddressSync(
    [Buffer.from("minter-info"), minter.toBuffer()],
    tbtcProgram.programId
  )[0]

  // // Adding a minter (wormholeGateway)
  // await tbtcProgram.methods
  //   .addMinter()
  //   .accounts({
  //     config,
  //     authority,
  //     minters,
  //     minterInfo,
  //     minter,
  //   })
  //   .instruction();
    
  // // update mappings (self?, arbitrum, optimism, polygon, base)

  // // arbitrum chain ID: 23
  // // ETH Goerli address: 0x00000000000000000000000031a15e213b59e230b45e8c5c99dafac3d1236ee2
  // // ETH Mainnet address: 0x0000000000000000000000001293a54e160d1cd7075487898d65266081a15458
  // const arbitrumChain = 23
  // const arbiArgs = {
  //   chain: arbitrumChain,
  //   address: Array.from(Buffer.alloc(32, "00000000000000000000000031a15e213b59e230b45e8c5c99dafac3d1236ee2", "hex"))
  // }

  // const encodedChain = Buffer.alloc(2);
  // encodedChain.writeUInt16LE(arbitrumChain);
  // const gatewayInfo = PublicKey.findProgramAddressSync(
  //   [Buffer.from("gateway-info"), encodedChain],
  //   wormholeGatewayProgram.programId
  // )[0]

  // wormholeGatewayProgram.methods
  //   .updateGatewayAddress(arbiArgs)
  //   .accounts({
  //     custodian: minter,
  //     gatewayInfo,
  //     authority,
  //   })
  //   .instruction();
  
  console.log("success")
}

;(async () => {
  try {
    await run()
  } catch (e) {
    console.log("Exception called:", e)
  }
})()

function loadKey(filename: string): Keypair {
  try {
    const contents = fs.readFileSync(filename).toString()
    const bs = Uint8Array.from(JSON.parse(contents))

    return Keypair.fromSecretKey(bs)
  } catch {
    console.log("Unable to read keypair...", filename)
  }
}