import * as anchor from "@coral-xyz/anchor"
import fs from "fs"
import { PublicKey, Keypair } from "@solana/web3.js"
import dotenv from "dotenv"

async function run(): Promise<void> {
  dotenv.config({ path: "solana.env" })

  const authority = loadKey(process.env.AUTHORITY)
  const newAuthority = process.env.THRESHOLD_COUNCIL_MULTISIG

  const tbtcProgram = anchor.workspace.Tbtc

  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    tbtcProgram.programId
  )[0];

  await tbtcProgram.methods
    .changeAuthority()
    .accounts({
      config,
      authority,
      newAuthority,
    })
    .instruction();
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