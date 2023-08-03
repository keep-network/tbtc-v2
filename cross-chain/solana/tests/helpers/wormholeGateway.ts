import { PublicKey } from "@solana/web3.js";
import { WORMHOLE_GATEWAY_PROGRAM_ID } from "./consts";

export function getCustodianPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("custodian")],
    WORMHOLE_GATEWAY_PROGRAM_ID
  )[0];
}

export function getGatewayInfoPDA(targetChain): PublicKey {
  const encodedChain = Buffer.alloc(2);
  encodedChain.writeUInt16LE(targetChain);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("gateway-info"), encodedChain],
    WORMHOLE_GATEWAY_PROGRAM_ID
  )[0];
}

export function getWrappedTbtcTokenPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("wrapped-token")],
    WORMHOLE_GATEWAY_PROGRAM_ID
  )[0];
}

export function getTokenBridgeSenderPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sender")],
    WORMHOLE_GATEWAY_PROGRAM_ID
  )[0];
}

export function getTokenBridgeRedeemerPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("redeemer")],
    WORMHOLE_GATEWAY_PROGRAM_ID
  )[0];
}
