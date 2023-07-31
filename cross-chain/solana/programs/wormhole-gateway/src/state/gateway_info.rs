use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct GatewayInfo {
    pub bump: u8,
    pub gateway: [u8; 32],
}

impl GatewayInfo {
    pub const SEED_PREFIX: &'static [u8] = b"gateway-info";
}
