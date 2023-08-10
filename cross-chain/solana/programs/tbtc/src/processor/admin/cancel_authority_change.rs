use crate::{error::TbtcError, state::Config};
use anchor_lang::prelude::*;

#[derive(Accounts)]

pub struct CancelAuthorityChange<'info> {
    #[account(
        mut,
        seeds = [Config::SEED_PREFIX],
        bump,
        has_one = authority @ TbtcError::IsNotAuthority,
        constraint = config.pending_authority.is_some() @ TbtcError::NoPendingAuthorityChange
    )]
    config: Account<'info, Config>,

    authority: Signer<'info>,
}

pub fn cancel_authority_change(ctx: Context<CancelAuthorityChange>) -> Result<()> {
    ctx.accounts.config.pending_authority = None;
    Ok(())
}
