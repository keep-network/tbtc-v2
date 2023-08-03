import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import * as web3 from '@solana/web3.js';

import { postVaaSolana } from "@certusone/wormhole-sdk";
import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import { NodeWallet } from "@certusone/wormhole-sdk/lib/cjs/solana";

import { WormholeGateway } from "../../target/types/wormhole_gateway";

const SOLANA_CORE_BRIDGE_ADDRESS = "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth";
const SOLANA_TOKEN_BRIDGE_ADDRESS = "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb";
const ETHEREUM_TOKEN_BRIDGE_ADDRESS = "0x3ee18B2214AFF97000D974cf647E7C347E8fa585";
const ETHEREUM_TBTC_ADDRESS = "0x18084fbA666a33d37592fA2633fD49a74DD93a88";

const GUARDIAN_SET_INDEX = 3;

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

export async function mockSignAndPostVaa(connection: web3.Connection, payer: web3.Keypair, published: Buffer) {
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

function toBytesLE(x): Buffer {
    const buf = Buffer.alloc(2);
    buf.writeUint16LE(x);
    return buf;
}