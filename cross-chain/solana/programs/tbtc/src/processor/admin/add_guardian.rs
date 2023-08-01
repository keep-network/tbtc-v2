use crate::{
    error::TbtcError,
    state::{Config, GuardianIndex, GuardianInfo},
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

    #[account(
        init,
        payer = authority,
        space = 8 + GuardianIndex::INIT_SPACE,
        seeds = [GuardianIndex::SEED_PREFIX, &[config.num_guardians]],
        bump
    )]
    guardian_index: Account<'info, GuardianIndex>,

    /// CHECK: Required authority to pause contract. This pubkey lives in `GuardianInfo`.
    guardian: AccountInfo<'info>,

    system_program: Program<'info, System>,
}

pub fn add_guardian(ctx: Context<AddGuardian>) -> Result<()> {
    ctx.accounts.guardian_info.set_inner(GuardianInfo {
        guardian: ctx.accounts.guardian.key(),
        index: ctx.accounts.config.num_guardians,
        bump: ctx.bumps["guardian_info"],
    });

    ctx.accounts.guardian_index.set_inner(GuardianIndex {
        guardian_info: ctx.accounts.guardian_info.key(),
        bump: ctx.bumps["guardian_index"],
    });

    ctx.accounts.config.num_guardians += 1;
    Ok(())
}
