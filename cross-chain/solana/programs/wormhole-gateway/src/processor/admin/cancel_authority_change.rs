use crate::{error::WormholeGatewayError, state::Custodian};
use anchor_lang::prelude::*;

#[derive(Accounts)]

pub struct CancelAuthorityChange<'info> {
    #[account(
        mut,
        seeds = [Custodian::SEED_PREFIX],
        bump,
        has_one = authority @ WormholeGatewayError::IsNotAuthority,
        constraint = custodian.pending_authority.is_some() @ WormholeGatewayError::NoPendingAuthorityChange
    )]
    custodian: Account<'info, Custodian>,

    authority: Signer<'info>,
}

pub fn cancel_authority_change(ctx: Context<CancelAuthorityChange>) -> Result<()> {
    ctx.accounts.custodian.pending_authority = None;
    Ok(())
}
