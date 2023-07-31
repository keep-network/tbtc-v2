use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct MinterInfo {
    pub minter: Pubkey,
    pub bump: u8,
}

impl MinterInfo {
    pub fn is_minter(&self, key: &Pubkey) -> bool {
        self.minter == *key
    }

    pub const MAXIMUM_SIZE: usize = 8 + 32 + 1; // discriminator + pubkey + bump
    pub const SEED_PREFIX: &'static [u8; 11] = b"minter-info";
}