use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct GuardianInfo {
    pub guardian: Pubkey,
    pub index: u8,
    pub bump: u8,
}

impl GuardianInfo {
    pub const SEED_PREFIX: &'static [u8] = b"guardian-info";
}
