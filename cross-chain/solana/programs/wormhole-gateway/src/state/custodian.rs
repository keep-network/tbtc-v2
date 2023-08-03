use anchor_lang::prelude::*;
use wormhole_anchor_sdk::token_bridge;

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
    // pub token_bridge_redeemer: Pubkey,
    // pub token_bridge_redeemer_bump: u8,
    pub minting_limit: u64,
    pub minted_amount: u64,
}

impl Custodian {
    /// TODO: This is an undesirable pattern in the Token Bridge due to how transfers are redeemed.
    pub const SEED_PREFIX: &'static [u8] = token_bridge::SEED_PREFIX_REDEEMER;
}
