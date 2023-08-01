use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct GuardianIndex {
    pub guardian_info: Pubkey,
    pub bump: u8,
}

impl GuardianIndex {
    pub const SEED_PREFIX: &'static [u8] = b"guardian-index";
}
