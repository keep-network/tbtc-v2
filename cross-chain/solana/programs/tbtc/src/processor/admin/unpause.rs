use crate::{error::TbtcError, state::Tbtc};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(
        mut,
        constraint = tbtc.paused @ TbtcError::IsNotPaused,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
}

pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
    ctx.accounts.tbtc.paused = false;
    Ok(())
}
