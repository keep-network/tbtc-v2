import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import * as web3 from '@solana/web3.js';
import { WormholeGateway } from "../../target/types/wormhole_gateway";

export function getCustodianPDA(
    program: Program<WormholeGateway>,
): [anchor.web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from('custodian'),
        ],
        program.programId
    );
}

export function getGatewayInfoPDA(
    program: Program<WormholeGateway>,
    targetChain
): [anchor.web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from('gateway-info'),
            toBytesLE(targetChain),
        ],
        program.programId
    );
}

export function getWrappedTbtcTokenPDA(
    program: Program<WormholeGateway>,
): [anchor.web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from('wrapped-token'),
        ],
        program.programId
    );
}

export function getTokenBridgeSenderPDA(
    program: Program<WormholeGateway>,
): [anchor.web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from('sender'),
        ],
        program.programId
    );
}

export function getTokenBridgeRedeemerPDA(
    program: Program<WormholeGateway>,
): [anchor.web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from('redeemer'),
        ],
        program.programId
    );
}

function toBytesLE(x): Buffer {
    const buf = Buffer.alloc(2);
    buf.writeUint16LE(x);
    return buf;
}