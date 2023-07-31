use crate::{
    error::TbtcError,
    state::{Config, GuardianInfo},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddGuardian<'info> {
    #[account(
        mut,
        seeds = [Config::SEED_PREFIX],
        bump,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    config: Account<'info, Config>,

    #[account(mut)]
    authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + GuardianInfo::INIT_SPACE,
        seeds = [GuardianInfo::SEED_PREFIX, guardian.key().as_ref()],
        bump
    )]
    guardian_info: Account<'info, GuardianInfo>,

    /// CHECK: Required authority to pause contract. This pubkey lives in `GuardianInfo`.
    guardian: AccountInfo<'info>,

    system_program: Program<'info, System>,
}

pub fn add_guardian(ctx: Context<AddGuardian>) -> Result<()> {
    ctx.accounts.guardian_info.set_inner(GuardianInfo {
        guardian: ctx.accounts.guardian.key(),
        bump: ctx.bumps["guardian_info"],
    });

    ctx.accounts.config.num_guardians += 1;
    Ok(())
}
