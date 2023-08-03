import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Tbtc } from "../../target/types/tbtc";
import { TBTC_PROGRAM_ID } from "./consts";

export function maybeAuthorityAnd(signer, signers) {
  return signers.concat(
    signer instanceof (anchor.Wallet as any) ? [] : [signer]
  );
}

export function getConfigPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    TBTC_PROGRAM_ID
  )[0];
}

export function getTokenPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tbtc-mint")],
    TBTC_PROGRAM_ID
  )[0];
}

export function getMinterPDA(minter: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("minter-info"), minter.toBuffer()],
    TBTC_PROGRAM_ID
  )[0];
}

export function getGuardianPDA(guardian): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("guardian-info"), guardian.publicKey.toBuffer()],
    TBTC_PROGRAM_ID
  )[0];
}

export function getGuardiansPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("guardians")],
    TBTC_PROGRAM_ID
  )[0];
}

export function getMintersPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("minters")],
    TBTC_PROGRAM_ID
  )[0];
}

export async function checkState(
  expectedAuthority,
  expectedMinters: number,
  expectedGuardians: number,
  expectedTokensSupply
) {
  const program = anchor.workspace.Tbtc as Program<Tbtc>;

  const config = getConfigPDA();
  let configState = await program.account.config.fetch(config);

  expect(configState.authority).to.eql(expectedAuthority.publicKey);
  expect(configState.numMinters).to.equal(expectedMinters);
  expect(configState.numGuardians).to.equal(expectedGuardians);

  let tbtcMint = configState.mint;

  let mintState = await getMint(program.provider.connection, tbtcMint);

  expect(mintState.supply).to.equal(BigInt(expectedTokensSupply));

  const guardians = getGuardiansPDA();
  let guardiansState = await program.account.guardians.fetch(guardians);
  expect(guardiansState.keys).has.length(expectedGuardians);

  const minters = getMintersPDA();
  let mintersState = await program.account.minters.fetch(minters);
  expect(mintersState.keys).has.length(expectedMinters);
}

export async function addMinter(
  authority,
  minter
): Promise<anchor.web3.PublicKey> {
  const program = anchor.workspace.Tbtc as Program<Tbtc>;

  const config = getConfigPDA();
  const minters = getMintersPDA();
  const minterInfoPDA = getMinterPDA(minter);
  await program.methods
    .addMinter()
    .accounts({
      config,
      authority: authority.publicKey,
      minters,
      minter,
      minterInfo: minterInfoPDA,
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
  return minterInfoPDA;
}
