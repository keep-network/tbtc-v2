use crate::{error::TbtcError, state::Config};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority,
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    config: Account<'info, Config>,

    authority: Signer<'info>,
}

impl<'info> Unpause<'info> {
    fn constraints(ctx: &Context<Self>) -> Result<()> {
        require!(ctx.accounts.config.paused, TbtcError::IsNotPaused);

        Ok(())
    }
}

#[access_control(Unpause::constraints(&ctx))]
pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
    ctx.accounts.config.paused = false;
    Ok(())
}
