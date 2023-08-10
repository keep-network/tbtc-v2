use crate::{
    error::TbtcError,
    state::{Config, MinterInfo, Minters},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RemoveMinter<'info> {
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
        mut,
        seeds = [Minters::SEED_PREFIX],
        bump = minters.bump,
        realloc = Minters::compute_size(minters.keys.len().saturating_sub(1)),
        realloc::payer = authority,
        realloc::zero = true,
    )]
    minters: Account<'info, Minters>,

    #[account(
        mut,
        has_one = minter,
        close = authority,
        seeds = [MinterInfo::SEED_PREFIX, minter.key().as_ref()],
        bump = minter_info.bump,
    )]
    minter_info: Account<'info, MinterInfo>,

    /// CHECK: Required authority to mint tokens. This pubkey lives in `MinterInfo`.
    minter: AccountInfo<'info>,

    system_program: Program<'info, System>,
}

pub fn remove_minter(ctx: Context<RemoveMinter>) -> Result<()> {
    let minters: &mut Vec<_> = &mut ctx.accounts.minters;
    let removed = ctx.accounts.minter.key();

    // It is safe to unwrap because the key we are removing is guaranteed to exist since there is
    // a minter info account for it.
    let index = minters
        .iter()
        .position(|&minter| minter == removed)
        .unwrap();

    // Remove pubkey to minters account.
    minters.swap_remove(index);

    // Update config.
    ctx.accounts.config.num_minters -= 1;

    emit!(crate::event::MinterRemoved { minter: removed });

    Ok(())
}
