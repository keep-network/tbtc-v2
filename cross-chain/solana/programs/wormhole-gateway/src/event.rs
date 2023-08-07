use anchor_lang::prelude::*;

#[event]
pub struct WormholeTbtcReceived {
    pub receiver: Pubkey,
    pub amount: u64,
}

#[event]
pub struct WormholeTbtcSent {
    pub amount: u64,
    pub recipient_chain: u16,
    pub gateway: [u8; 32],
    pub recipient: [u8; 32],
    pub arbiter_fee: u64,
    pub nonce: u32,
}

#[event]
pub struct WormholeTbtcDeposited {
    pub depositor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct GatewayAddressUpdated {
    pub chain: u16,
    pub gateway: [u8; 32],
}

#[event]
pub struct MintingLimitUpdated {
    pub minting_limit: u64,
}
