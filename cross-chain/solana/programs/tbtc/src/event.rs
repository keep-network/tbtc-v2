use anchor_lang::prelude::*;

#[event]
pub struct MinterAdded {
    pub minter: Pubkey,
}

#[event]
pub struct MinterRemoved {
    pub minter: Pubkey,
}

#[event]
pub struct GuardianAdded {
    pub guardian: Pubkey,
}

#[event]
pub struct GuardianRemoved {
    pub guardian: Pubkey,
}
