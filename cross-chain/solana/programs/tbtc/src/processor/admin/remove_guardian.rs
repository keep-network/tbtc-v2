use crate::{
    error::TbtcError,
    state::{Tbtc, GuardianInfo},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(guardian: Pubkey)]
pub struct RemoveGuardian<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority,
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = guardian,
        close = authority,
        seeds = [GuardianInfo::SEED_PREFIX, tbtc.key().as_ref(), guardian.as_ref()],
        bump = guardian_info.bump,
    )]
    pub guardian_info: Account<'info, GuardianInfo>,
}

pub fn remove_guardian(ctx: Context<RemoveGuardian>, _guardian: Pubkey) -> Result<()> {
    ctx.accounts.tbtc.guardians -= 1;
    Ok(())
}
