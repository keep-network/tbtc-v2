use crate::{
    error::TbtcError,
    state::{Config, GuardianIndex, GuardianInfo},
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

    // the guardian info to remove
    #[account(
        mut,
        has_one = guardian,
        close = authority,
        seeds = [GuardianInfo::SEED_PREFIX, guardian.key().as_ref()],
        bump = guardian_info.bump,
    )]
    guardian_info: Account<'info, GuardianInfo>,

    // the guardian info at the last index.
    // This gets its index swapped to the position of the removed guardian info.
    #[account(
        mut,
        constraint = guardian_info_swap.index == config.num_guardians - 1,
        seeds = [GuardianInfo::SEED_PREFIX, guardian_info_swap.guardian.as_ref()],
        bump = guardian_info_swap.bump,
    )]
    guardian_info_swap: Account<'info, GuardianInfo>,

    // The index account of the guardian to remove.
    // We replace guardian_info in this with guardian_info_swap.
    #[account(
        mut,
        seeds = [GuardianIndex::SEED_PREFIX, &[guardian_info.index]],
        bump = guardian_index_swap.bump,
    )]
    guardian_index_swap: Account<'info, GuardianIndex>,

    // The last guardian index account.
    // This gets removed, and its guardian_info(_swap) gets put into guardian_index_swap instead.
    #[account(
        mut,
        close = authority,
        seeds = [GuardianIndex::SEED_PREFIX, &[config.num_guardians - 1]],
        bump = guardian_index_tail.bump,
        constraint = guardian_index_tail.guardian_info == guardian_info_swap.key(),
    )]
    guardian_index_tail: Account<'info, GuardianIndex>,

    /// CHECK: Required authority to pause contract. This pubkey lives in `GuardianInfo`.
    guardian: AccountInfo<'info>,
}

pub fn remove_guardian(ctx: Context<RemoveGuardian>) -> Result<()> {
    ctx.accounts.guardian_index_swap.guardian_info = ctx.accounts.guardian_index_tail.guardian_info;
    ctx.accounts.guardian_info_swap.index = ctx.accounts.guardian_info.index;
    ctx.accounts.config.num_guardians -= 1;
    Ok(())
}
