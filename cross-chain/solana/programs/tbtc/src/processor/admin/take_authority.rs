use crate::{error::TbtcError, state::Config};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct TakeAuthority<'info> {
    #[account(
        mut,
        seeds = [Config::SEED_PREFIX],
        bump,
        constraint = config.pending_authority.is_some() @ TbtcError::NoPendingAuthorityChange
    )]
    config: Account<'info, Config>,

    #[account(
        constraint = pending_authority.key() == config.pending_authority.unwrap() @ TbtcError::IsNotPendingAuthority
    )]
    pending_authority: Signer<'info>,
}

pub fn take_authority(ctx: Context<TakeAuthority>) -> Result<()> {
    ctx.accounts.config.authority = ctx.accounts.pending_authority.key();
    ctx.accounts.config.pending_authority = None;
    Ok(())
}