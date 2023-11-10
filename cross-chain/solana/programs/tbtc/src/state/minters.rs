use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct Minters {
    pub bump: u8,
    pub keys: Vec<Pubkey>,
}

impl Minters {
    pub const SEED_PREFIX: &'static [u8] = b"minters";

    pub(crate) fn compute_size(num_minters: usize) -> usize {
        8 + 1 + 4 + num_minters * 32
    }
}

impl std::ops::Deref for Minters {
    type Target = Vec<Pubkey>;

    fn deref(&self) -> &Self::Target {
        &self.keys
    }
}

impl std::ops::DerefMut for Minters {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.keys
    }
}
