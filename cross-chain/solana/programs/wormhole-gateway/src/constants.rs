pub const TBTC_ETHEREUM_TOKEN_CHAIN: u16 = 2;

#[cfg(feature = "mainnet")]
pub const TBTC_ETHEREUM_TOKEN_ADDRESS: [u8; 32] = [
    0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x18, 0x08, 0x4f, 0xba, 0x66, 0x6a,
    0x33, 0xd3, 0x75, 0x92, 0xfa, 0x26, 0x33, 0xfd, 0x49, 0xa7, 0x4D, 0xd9, 0x3a, 0x88,
];

/// TODO: Fix this to reflect testnet contract address.
#[cfg(feature = "solana-devnet")]
pub const TBTC_ETHEREUM_TOKEN_ADDRESS: [u8; 32] = [
    0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x18, 0x08, 0x4f, 0xbA, 0x66, 0x6a,
    0x33, 0xd3, 0x75, 0x92, 0xfa, 0x26, 0x33, 0xfD, 0x49, 0xa7, 0x4d, 0xd9, 0x3a, 0x88,
];