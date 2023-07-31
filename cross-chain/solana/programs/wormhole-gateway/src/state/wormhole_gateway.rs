use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct WormholeGateway {
    pub authority: Pubkey,
    pub wormhole_token_bridge: Pubkey,
    pub wormhole_bridge_token_mint: Pubkey,
    pub tbtc: Pubkey,
    pub tbtc_mint: Pubkey,
    pub minting_limit: u64,
    pub minted_amount: u64,
    pub self_bump: u8,
}

impl WormholeGateway {
    // 8 discriminator
    // 32 * 5 = 160 (5 pubkeys)
    // 8 * 2 = 16   (2 u64s)
    // 1            (bump)
    pub const MAXIMUM_SIZE: usize = 8 + 160 + 16 + 1;
}