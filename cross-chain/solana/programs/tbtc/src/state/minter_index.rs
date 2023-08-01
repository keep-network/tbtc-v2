use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct MinterIndex {
    pub minter_info: Pubkey,
    pub bump: u8,
}

impl MinterIndex {
    pub const SEED_PREFIX: &'static [u8] = b"minter-index";
}
