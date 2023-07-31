use crate::{
    error::WormholeGatewayError,
    state::{GatewayInfo, WormholeGateway},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(chain_id: u16)]
pub struct UpdateGatewayAddress<'info> {
    #[account(
        has_one = authority @ WormholeGatewayError::IsNotAuthority,
    )]
    pub wormhole_gateway: Account<'info, WormholeGateway>,
    #[account(
        init_if_needed,
        payer = payer,
        space = GatewayInfo::MAXIMUM_SIZE,
        seeds = [GatewayInfo::SEED_PREFIX, wormhole_gateway.key().as_ref(), chain_id],
        bump,
    )]
    pub gateway_info: Account<'info, GatewayInfo>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn update_gateway_address(
    ctx: Context<UpdateGatewayAddress>,
    chain_id: u16,
    gateway_address: [u8; 32],
) -> Result<()> {
    ctx.accounts.gateway_info.gateway = gateway_address;
    Ok(())
}