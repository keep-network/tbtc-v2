use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Custodian {
    pub bump: u8,
    pub authority: Pubkey,

    pub tbtc_mint: Pubkey,
    pub wrapped_tbtc_mint: Pubkey,
    pub wrapped_tbtc_token: Pubkey,
    pub token_bridge_sender: Pubkey,
    pub token_bridge_sender_bump: u8,
    pub token_bridge_redeemer: Pubkey,
    pub token_bridge_redeemer_bump: u8,

    pub minting_limit: u64,
}

impl Custodian {
    pub const SEED_PREFIX: &'static [u8] = b"custodian";
}
