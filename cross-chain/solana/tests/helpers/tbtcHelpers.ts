import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import * as web3 from '@solana/web3.js';
import { Tbtc } from "../../target/types/tbtc";

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
            minter.publicKey.toBuffer(),
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
  