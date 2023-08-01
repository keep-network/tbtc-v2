use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct MinterInfo {
    pub minter: Pubkey,
    pub index: u8,
    pub bump: u8,
}

impl MinterInfo {
    pub const SEED_PREFIX: &'static [u8] = b"minter-info";
}
