use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Custodian {
    pub bump: u8,
    pub authority: Pubkey,

    pub tbtc_mint: Pubkey,
    pub wrapped_tbtc_mint: Pubkey,
    pub wrapped_tbtc_token: Pubkey,

    pub minting_limit: u64,
}

impl Custodian {
    pub const SEED_PREFIX: &'static [u8] = b"custodian";
}
