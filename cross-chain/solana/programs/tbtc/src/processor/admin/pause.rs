use crate::{
    error::TbtcError,
    state::{Config, GuardianInfo},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(
        mut,
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    config: Account<'info, Config>,

    #[account(
        has_one = guardian,
        seeds = [GuardianInfo::SEED_PREFIX, guardian.key().as_ref()],
        bump = guardian_info.bump
    )]
    guardian_info: Account<'info, GuardianInfo>,

    guardian: Signer<'info>,
}

impl<'info> Pause<'info> {
    fn constraints(ctx: &Context<Self>) -> Result<()> {
        require!(!ctx.accounts.config.paused, TbtcError::IsPaused);

        Ok(())
    }
}

#[access_control(Pause::constraints(&ctx))]
pub fn pause(ctx: Context<Pause>) -> Result<()> {
    ctx.accounts.config.paused = true;
    Ok(())
}
