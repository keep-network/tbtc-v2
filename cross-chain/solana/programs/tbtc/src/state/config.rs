use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Config {
    pub bump: u8,

    /// The authority over this program.
    pub authority: Pubkey,
    pub pending_authority: Option<Pubkey>,

    // Mint info.
    pub mint: Pubkey,
    pub mint_bump: u8,

    // Admin info.
    pub num_minters: u8,
    pub num_guardians: u8,
    pub paused: bool,
}

impl Config {
    pub const SEED_PREFIX: &'static [u8] = b"config";
}
