use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct GuardianInfo {
    pub bump: u8,
    pub guardian: Pubkey,
}

impl GuardianInfo {
    pub const SEED_PREFIX: &'static [u8] = b"guardian-info";
}
