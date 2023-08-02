use crate::{
    error::TbtcError,
    state::{Config, GuardianInfo},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RemoveGuardian<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority,
    )]
    config: Account<'info, Config>,

    authority: Signer<'info>,

    #[account(
        mut,
        has_one = guardian,
        close = authority,
        seeds = [GuardianInfo::SEED_PREFIX, guardian.key().as_ref()],
        bump = guardian_info.bump,
    )]
    guardian_info: Account<'info, GuardianInfo>,

    /// CHECK: Required authority to pause contract. This pubkey lives in `GuardianInfo`.
    guardian: AccountInfo<'info>,
}

pub fn remove_guardian(ctx: Context<RemoveGuardian>) -> Result<()> {
    ctx.accounts.config.num_guardians -= 1;
    Ok(())
}
