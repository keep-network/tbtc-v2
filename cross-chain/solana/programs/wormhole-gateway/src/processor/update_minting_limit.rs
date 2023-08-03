use crate::{error::WormholeGatewayError, state::Custodian};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateMintingLimit<'info> {
    #[account(
        mut,
        seeds = [Custodian::SEED_PREFIX],
        bump = custodian.bump,
        has_one = authority @ WormholeGatewayError::IsNotAuthority,
    )]
    custodian: Account<'info, Custodian>,

    authority: Signer<'info>,
}

pub fn update_minting_limit(ctx: Context<UpdateMintingLimit>, new_limit: u64) -> Result<()> {
    ctx.accounts.custodian.minting_limit = new_limit;
    Ok(())
}
