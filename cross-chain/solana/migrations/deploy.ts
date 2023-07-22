import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import fs from "fs";
import { Keypair } from "@solana/web3.js";
import dotenv from "dotenv";

module.exports = async function (provider) {
  dotenv.config({ path: "../solana.env" })

  anchor.setProvider(provider);

  const program = anchor.workspace.Tbtc;
  // This wallet deployed the program and is also an authority
  const authority = loadKey(process.env.WALLET);
  const tbtcKeys = loadKey(process.env.TBTC_KEYS);

  const [tbtcMintPDA, _] = web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("tbtc-mint"),
      tbtcKeys.publicKey.toBuffer(),
    ],
    program.programId,
  );

  // Initalize tbtc program
  await program.methods
    .initialize()
    .accounts({
      tbtcMint: tbtcMintPDA,
      tbtc: tbtcKeys.publicKey,
      authority: authority.publicKey,
    })
    .signers([tbtcKeys])
    .rpc();

  // add a minter (wormhole gateway (minter keys))
  
  // add a guardian?

  // update mappings (self, arbitrum, optimism, polygon)

  // transfer ownership to council
  // solana program set-upgrade-authority -k <current_keypair_path> <programID> --new-upgrade-authority <pubkey>
};

function loadKey(filename: string): Keypair {
  try {
    const contents = fs.readFileSync(filename).toString();
    const bs = Uint8Array.from(JSON.parse(contents));

    return Keypair.fromSecretKey(bs);
  } catch {
    console.log("Unable to read keypair...", filename);
  }
}
