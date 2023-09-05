use crate::{error::TbtcError, state::Config};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ChangeAuthority<'info> {
    #[account(
        mut,
        seeds = [Config::SEED_PREFIX],
        bump,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    config: Account<'info, Config>,

    authority: Signer<'info>,

    /// CHECK: New authority.
    new_authority: AccountInfo<'info>,
}

pub fn change_authority(ctx: Context<ChangeAuthority>) -> Result<()> {
    ctx.accounts.config.pending_authority = Some(ctx.accounts.new_authority.key());
    Ok(())
}
