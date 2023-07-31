use crate::{
    error::WormholeGatewayError,
    state::WormholeGateway,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateMintingLimit<'info> {
    #[account(
        mut,
        has_one = authority @ WormholeGatewayError::IsNotAuthority,
    )]
    pub wormhole_gateway: Account<'info, WormholeGateway>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

pub fn update_minting_limit(ctx: Context<UpdateMintingLimit>, new_limit: u64) -> Result<()> {
    ctx.accounts.wormhole_gateway.minting_limit = new_limit;
    Ok(())
}