use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct GatewayInfo {
    pub gateway: [u8; 32],
    pub bump: u8,
}

impl GatewayInfo {
    pub const MAXIMUM_SIZE: usize = 8 + 32 + 1;
    pub const SEED_PREFIX: &'static [u8; 12] = b"gateway-info";
}