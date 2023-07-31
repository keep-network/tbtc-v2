use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct GuardianInfo {
    pub guardian: Pubkey,
    pub bump: u8,
}

impl GuardianInfo {
    pub const SEED_PREFIX: &'static [u8; 13] = b"guardian-info";
}
