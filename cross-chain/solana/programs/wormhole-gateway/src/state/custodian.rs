use anchor_lang::prelude::*;
use wormhole_anchor_sdk::token_bridge;

#[account]
#[derive(Debug, InitSpace)]
pub struct Custodian {
    pub bump: u8,
    pub authority: Pubkey,
    pub pending_authority: Option<Pubkey>,

    pub tbtc_mint: Pubkey,
    pub wrapped_tbtc_mint: Pubkey,
    pub wrapped_tbtc_token: Pubkey,
    pub token_bridge_sender: Pubkey,
    pub token_bridge_sender_bump: u8,
    pub minting_limit: u64,
    pub minted_amount: u64,
}

impl Custodian {
    /// Due to the Token Bridge requiring the redeemer PDA be the owner of the token account for
    /// completing transfers with payload, we are conveniently having the Custodian's PDA address
    /// derived as this redeemer.
    pub const SEED_PREFIX: &'static [u8] = token_bridge::SEED_PREFIX_REDEEMER;
}
