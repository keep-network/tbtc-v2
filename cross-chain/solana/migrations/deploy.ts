import * as anchor from "@coral-xyz/anchor"
import fs from "fs"
import { PublicKey, Keypair } from "@solana/web3.js"
import dotenv from "dotenv"
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

module.exports = async function (provider) {
  dotenv.config({ path: "../solana.env" })

  anchor.setProvider(provider)

  const tbtcProgram = anchor.workspace.Tbtc
  // This wallet deployed the program and is also an authority
  const authority = loadKey(process.env.AUTHORITY)
  const newAuthority = process.env.THRESHOLD_COUNCIL_MULTISIG

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

  // add minter

  // add guardian?

  // update mappings (self, base, arbitrum, optimism, polygon)
}

function loadKey(filename: string): Keypair {
  try {
    const contents = fs.readFileSync(filename).toString()
    const bs = Uint8Array.from(JSON.parse(contents))

    return Keypair.fromSecretKey(bs)
  } catch {
    console.log("Unable to read keypair...", filename)
  }
}