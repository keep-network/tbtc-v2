use crate::{
    error::TbtcError,
    state::{Config, GuardianInfo, Guardians},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RemoveGuardian<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority,
    )]
    config: Account<'info, Config>,

    #[account(mut)]
    authority: Signer<'info>,

    #[account(
        mut,
        seeds = [Guardians::SEED_PREFIX],
        bump = guardians.bump,
        realloc = Guardians::compute_size(guardians.keys.len().saturating_sub(1)),
        realloc::payer = authority,
        realloc::zero = true,
    )]
    guardians: Account<'info, Guardians>,

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

    system_program: Program<'info, System>,
}

pub fn remove_guardian(ctx: Context<RemoveGuardian>) -> Result<()> {
    let guardians: &mut Vec<_> = &mut ctx.accounts.guardians;
    let removed = ctx.accounts.guardian.key();
    match guardians.iter().position(|&guardian| guardian == removed) {
        Some(index) => {
            // Remove pubkey to guardians account.
            guardians.swap_remove(index);

            // Update config.
            ctx.accounts.config.num_guardians -= 1;

            emit!(crate::event::GuardianRemoved { guardian: removed });

            Ok(())
        }
        None => err!(TbtcError::GuardianNonexistent),
    }
}
