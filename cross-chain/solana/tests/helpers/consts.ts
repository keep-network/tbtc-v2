import { PublicKey } from "@solana/web3.js";

export const TBTC_PROGRAM_ID = new PublicKey(
  "HksEtDgsXJV1BqcuhzbLRTmXp5gHgHJktieJCtQd3pG"
);
export const WORMHOLE_GATEWAY_PROGRAM_ID = new PublicKey(
  "8H9F5JGbEMyERycwaGuzLS5MQnV7dn2wm2h6egJ3Leiu"
);

export const CORE_BRIDGE_PROGRAM_ID = new PublicKey(
  "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
);
export const TOKEN_BRIDGE_PROGRAM_ID = new PublicKey(
  "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb"
);

export const ETHEREUM_TOKEN_BRIDGE_ADDRESS =
  "0x3ee18B2214AFF97000D974cf647E7C347E8fa585";
export const ETHEREUM_TBTC_ADDRESS =
  "0x18084fbA666a33d37592fA2633fD49a74DD93a88";

export const GUARDIAN_SET_INDEX = 3;
export const GUARDIAN_DEVNET_PRIVATE_KEYS = [
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0",
];

// relevant core bridge PDAs
export const CORE_BRIDGE_DATA = new PublicKey(
  "2yVjuQwpsvdsrywzsJJVs9Ueh4zayyo5DYJbBNc3DDpn"
);
export const CORE_EMITTER_SEQUENCE = new PublicKey(
  "GF2ghkjwsR9CHkGk1RvuZrApPZGBZynxMm817VNi51Nf"
);
export const CORE_FEE_COLLECTOR = new PublicKey(
  "9bFNrXNb2WTx8fMHXCheaZqkLZ3YCCaiqTftHxeintHy"
);

// relevant token bridge PDAs
export const WRAPPED_TBTC_MINT = new PublicKey(
  "25rXTx9zDZcHyTav5sRqM6YBvTGu9pPH9yv83uAEqbgG"
);
export const WRAPPED_TBTC_ASSET = new PublicKey(
  "5LEUZpBxUQmoxoNGqmYmFEGAPDuhWbAY5CGt519UixLo"
);
export const ETHEREUM_ENDPOINT = new PublicKey(
  "DujfLgMKW71CT2W8pxknf42FT86VbcK5PjQ6LsutjWKC"
);
export const TOKEN_BRIDGE_CONFIG = new PublicKey(
  "DapiQYH3BGonhN8cngWcXQ6SrqSm3cwysoznoHr6Sbsx"
);
