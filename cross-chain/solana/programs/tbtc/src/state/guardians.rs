use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct Guardians {
    pub bump: u8,
    pub keys: Vec<Pubkey>,
}

impl Guardians {
    pub const SEED_PREFIX: &'static [u8] = b"guardians";

    pub(crate) fn compute_size(num_guardians: usize) -> usize {
        8 + 1 + 4 + num_guardians * 32
    }
}

impl std::ops::Deref for Guardians {
    type Target = Vec<Pubkey>;

    fn deref(&self) -> &Self::Target {
        &self.keys
    }
}

impl std::ops::DerefMut for Guardians {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.keys
    }
}
