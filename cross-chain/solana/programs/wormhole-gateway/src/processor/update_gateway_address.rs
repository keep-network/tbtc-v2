use crate::{
    error::WormholeGatewayError,
    state::{Custodian, GatewayInfo},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(chain_id: u16)]
pub struct UpdateGatewayAddress<'info> {
    #[account(
        seeds = [Custodian::SEED_PREFIX],
        bump = custodian.bump,
        has_one = authority @ WormholeGatewayError::IsNotAuthority,
    )]
    pub custodian: Account<'info, Custodian>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + GatewayInfo::INIT_SPACE,
        seeds = [GatewayInfo::SEED_PREFIX, &chain_id.to_le_bytes()],
        bump,
    )]
    pub gateway_info: Account<'info, GatewayInfo>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn update_gateway_address(
    ctx: Context<UpdateGatewayAddress>,
    chain_id: u16,
    gateway: [u8; 32],
) -> Result<()> {
    ctx.accounts.gateway_info.set_inner(GatewayInfo {
        bump: ctx.bumps["gateway_info"],
        gateway,
    });

    Ok(())
}
