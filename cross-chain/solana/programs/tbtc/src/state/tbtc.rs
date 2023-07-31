use anchor_lang::prelude::*;


#[account]
#[derive(Default)]
pub struct Tbtc {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub token_bump: u8,
    pub minters: u8,
    pub guardians: u8,
    pub paused: bool,
}

impl Tbtc {
    // 8 discriminator
    // 32 pubkey
    // 32 pubkey
    // 1 u8
    // 1 u8
    // 1 u8
    // 1 bool
    pub const MAXIMUM_SIZE: usize = 8 + 32 + 32 + 1 + 1 + 1 + 1;
}