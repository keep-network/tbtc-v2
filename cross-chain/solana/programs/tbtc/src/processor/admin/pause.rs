use crate::{
    error::TbtcError,
    state::{GuardianInfo, Tbtc},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(
        mut,
        constraint = !tbtc.paused @ TbtcError::IsPaused
    )]
    pub tbtc: Account<'info, Tbtc>,
    #[account(
        has_one = guardian,
        seeds = [GuardianInfo::SEED_PREFIX, tbtc.key().as_ref(), guardian.key().as_ref()],
        bump = guardian_info.bump
    )]
    pub guardian_info: Account<'info, GuardianInfo>,
    pub guardian: Signer<'info>,
}

pub fn pause(ctx: Context<Pause>) -> Result<()> {
    ctx.accounts.tbtc.paused = true;
    Ok(())
}
