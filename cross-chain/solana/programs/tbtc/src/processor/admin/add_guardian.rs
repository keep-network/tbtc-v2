use crate::{
    error::TbtcError,
    state::{GuardianInfo, Tbtc},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddGuardian<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
    pub guardian: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = GuardianInfo::MAXIMUM_SIZE,
        seeds = [GuardianInfo::SEED_PREFIX, tbtc.key().as_ref(), guardian.key().as_ref()], bump
    )]
    pub guardian_info: Account<'info, GuardianInfo>,
    pub system_program: Program<'info, System>,
}

pub fn add_guardian(ctx: Context<AddGuardian>) -> Result<()> {
    ctx.accounts.guardian_info.set_inner(GuardianInfo {
        guardian: ctx.accounts.guardian.key(),
        bump: *ctx.bumps.get("guardian_info").unwrap(),
    });

    ctx.accounts.tbtc.guardians += 1;
    Ok(())
}
