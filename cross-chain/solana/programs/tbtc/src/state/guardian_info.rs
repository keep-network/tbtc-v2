use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct GuardianInfo {
    pub guardian: Pubkey,
    pub bump: u8,
}

impl GuardianInfo {
    pub fn is_guardian(&self, key: &Pubkey) -> bool {
        self.guardian == *key
    }

    pub const MAXIMUM_SIZE: usize = 8 + 32 + 1; // discriminator + pubkey + bump
    pub const SEED_PREFIX: &'static [u8; 13] = b"guardian-info";
}
