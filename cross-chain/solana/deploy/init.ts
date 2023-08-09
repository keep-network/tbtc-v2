import * as anchor from "@coral-xyz/anchor"
import fs from "fs"
import { PublicKey, Keypair } from "@solana/web3.js"
import dotenv from "dotenv"
import { Program } from "@coral-xyz/anchor"
import { Tbtc } from "../target/types/tbtc"
import { WormholeGateway } from "../target/types/wormhole_gateway"
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata"
import * as consts from "./helpers/consts"

async function run(): Promise<void> {
  dotenv.config({ path: "../solana.env" })

  anchor.setProvider(anchor.AnchorProvider.env())

  const tbtcProgram = anchor.workspace.Tbtc as Program<Tbtc>
  const wormholeGatewayProgram = anchor.workspace
    .WormholeGateway as Program<WormholeGateway>

  console.log("tbtcProgram.programId", tbtcProgram.programId)
  console.log(
    "wormholeGatewayProgram.programId",
    wormholeGatewayProgram.programId
  )

  // This wallet deployed the program and is also an authority
  const authority = loadKey(process.env.AUTHORITY).publicKey

  const mint = PublicKey.findProgramAddressSync(
    [Buffer.from("tbtc-mint")],
    tbtcProgram.programId
  )[0]

  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    tbtcProgram.programId
  )[0]

  const guardians = PublicKey.findProgramAddressSync(
    [Buffer.from("guardians")],
    tbtcProgram.programId
  )[0]

  const minters = PublicKey.findProgramAddressSync(
    [Buffer.from("minters")],
    tbtcProgram.programId
  )[0]

  const tbtcMetadata = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  )[0]

  const mplTokenMetadataProgram = METADATA_PROGRAM_ID

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
      mplTokenMetadataProgram,
    })
    .rpc()

  const minter = PublicKey.findProgramAddressSync(
    [Buffer.from("redeemer")],
    wormholeGatewayProgram.programId
  )[0]

  const mintingLimit = 10000 // Arbitrary big number of TBTC
  let WRAPPED_TBTC = consts.WRAPPED_TBTC_MINT_TESTNET
  if (process.env.CLUSTER === "mainnet-beta") {
    WRAPPED_TBTC = consts.WRAPPED_TBTC_MINT_MAINNET
  }
  const WRAPPED_TBTC_MINT = new PublicKey(WRAPPED_TBTC)

  const gatewayWrappedTbtcToken = PublicKey.findProgramAddressSync(
    [Buffer.from("wrapped-token")],
    wormholeGatewayProgram.programId
  )[0]

  const tokenBridgeSender = PublicKey.findProgramAddressSync(
    [Buffer.from("sender")],
    wormholeGatewayProgram.programId
  )[0]

  // Initialize wormhole gateway
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
    .rpc()

  const minterInfo = PublicKey.findProgramAddressSync(
    [Buffer.from("minter-info"), minter.toBuffer()],
    tbtcProgram.programId
  )[0]

  // Adding a minter (wormholeGateway)
  await tbtcProgram.methods
    .addMinter()
    .accounts({
      config,
      authority,
      minters,
      minterInfo,
      minter,
    })
    .rpc()

  // Point to devnet addresses by default
  let ARBITRUM_GATEWAY = consts.ARBITRUM_GATEWAY_ADDRESS_TESTNET
  let OPTIMISM_GATEWAY = consts.ARBITRUM_GATEWAY_ADDRESS_TESTNET
  let POLYGON_GATEWAY = consts.ARBITRUM_GATEWAY_ADDRESS_TESTNET
  let BASE_GATEWAY = consts.ARBITRUM_GATEWAY_ADDRESS_TESTNET
  if (process.env.CLUSTER === "mainnet-beta") {
    ARBITRUM_GATEWAY = consts.ARBITRUM_GATEWAY_ADDRESS_MAINNET
    OPTIMISM_GATEWAY = consts.OPTIMISM_GATEWAY_ADDRESS_MAINNET
    POLYGON_GATEWAY = consts.POLYGON_GATEWAY_ADDRESS_MAINNET
    BASE_GATEWAY = consts.BASE_GATEWAY_ADDRESS_MAINNET
  }

  // Updating with Arbitrum
  const arbiArgs = {
    chain: consts.WH_ARBITRUM_CHAIN_ID,
    address: Array.from(Buffer.alloc(32, ARBITRUM_GATEWAY, "hex")),
  }

  const encodedArbiChain = Buffer.alloc(2)
  encodedArbiChain.writeUInt16LE(consts.WH_ARBITRUM_CHAIN_ID)
  const gatewayArbiInfo = PublicKey.findProgramAddressSync(
    [Buffer.from("gateway-info"), encodedArbiChain],
    wormholeGatewayProgram.programId
  )[0]

  wormholeGatewayProgram.methods
    .updateGatewayAddress(arbiArgs)
    .accounts({
      custodian: minter,
      gatewayInfo: gatewayArbiInfo,
      authority,
    })
    .rpc()

  // Updating with Optimism
  const optiArgs = {
    chain: consts.WH_OPTIMISM_CHAIN_ID,
    address: Array.from(Buffer.alloc(32, OPTIMISM_GATEWAY, "hex")),
  }

  const encodedOptiChain = Buffer.alloc(2)
  encodedOptiChain.writeUInt16LE(consts.WH_OPTIMISM_CHAIN_ID)
  const gatewayOptiInfo = PublicKey.findProgramAddressSync(
    [Buffer.from("gateway-info"), encodedOptiChain],
    wormholeGatewayProgram.programId
  )[0]

  wormholeGatewayProgram.methods
    .updateGatewayAddress(optiArgs)
    .accounts({
      custodian: minter,
      gatewayInfo: gatewayOptiInfo,
      authority,
    })
    .rpc()

  // Updating with Polygon
  const polyArgs = {
    chain: consts.WH_POLYGON_CHAIN_ID,
    address: Array.from(Buffer.alloc(32, POLYGON_GATEWAY, "hex")),
  }

  const encodedPolyChain = Buffer.alloc(2)
  encodedPolyChain.writeUInt16LE(consts.WH_POLYGON_CHAIN_ID)
  const gatewayPolyInfo = PublicKey.findProgramAddressSync(
    [Buffer.from("gateway-info"), encodedPolyChain],
    wormholeGatewayProgram.programId
  )[0]

  wormholeGatewayProgram.methods
    .updateGatewayAddress(polyArgs)
    .accounts({
      custodian: minter,
      gatewayInfo: gatewayPolyInfo,
      authority,
    })
    .rpc()

  // Updating with BASE
  const baseArgs = {
    chain: consts.WH_BASE_CHAIN_ID,
    address: Array.from(Buffer.alloc(32, BASE_GATEWAY, "hex")),
  }

  const encodedBaseChain = Buffer.alloc(2)
  encodedBaseChain.writeUInt16LE(consts.WH_BASE_CHAIN_ID)
  const gatewayBaseInfo = PublicKey.findProgramAddressSync(
    [Buffer.from("gateway-info"), encodedBaseChain],
    wormholeGatewayProgram.programId
  )[0]

  wormholeGatewayProgram.methods
    .updateGatewayAddress(baseArgs)
    .accounts({
      custodian: minter,
      gatewayInfo: gatewayBaseInfo,
      authority,
    })
    .rpc()

  // TODO: confirm with the WH team if Solana gateway should be self updated just
  // like we do on EVMs, i.e updateGatewayAddress(solanaArgs)

  console.log("Done initializing programs!")
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
