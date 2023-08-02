import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import * as web3 from '@solana/web3.js';
import { Tbtc } from "../../target/types/tbtc";
import { expect } from 'chai';

export function maybeAuthorityAnd(
    signer,
    signers
  ) {
    return signers.concat(signer instanceof (anchor.Wallet as any) ? [] : [signer]);
  }

export function getConfigPDA(
    program: Program<Tbtc>,
): [anchor.web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from('config'),
        ],
        program.programId
    );
}
  
export function getTokenPDA(
    program: Program<Tbtc>,
): [anchor.web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from('tbtc-mint'),
        ],
        program.programId
    );
}
  
export function getMinterPDA(
    program: Program<Tbtc>,
    minter
): [anchor.web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from('minter-info'),
            minter.toBuffer(),
        ],
        program.programId
    );
}
  

export function getGuardianPDA(
    program: Program<Tbtc>,
    guardian
): [anchor.web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from('guardian-info'),
            guardian.publicKey.toBuffer(),
        ],
        program.programId
    );
}

export async function checkState(
    program: Program<Tbtc>,
    expectedAuthority,
    expectedMinters,
    expectedGuardians,
    expectedTokensSupply
  ) {
    const [config,] = getConfigPDA(program);
    let configState = await program.account.config.fetch(config);
  
    expect(configState.authority).to.eql(expectedAuthority.publicKey);
    expect(configState.numMinters).to.equal(expectedMinters);
    expect(configState.numGuardians).to.equal(expectedGuardians);
  
    let tbtcMint = configState.mint;
  
    let mintState = await spl.getMint(program.provider.connection, tbtcMint);
  
    expect(mintState.supply).to.equal(BigInt(expectedTokensSupply));
  }

export async function addMinter(
    program: Program<Tbtc>,
    authority,
    minter
  ): Promise<anchor.web3.PublicKey> {
    const [config,] = getConfigPDA(program);
    const [minterInfoPDA, _] = getMinterPDA(program, minter);
    await program.methods
      .addMinter()
      .accounts({
        config,
        authority: authority.publicKey,
        minter,
        minterInfo: minterInfoPDA,
      })
      .signers(maybeAuthorityAnd(authority, []))
      .rpc();
    return minterInfoPDA;
  }