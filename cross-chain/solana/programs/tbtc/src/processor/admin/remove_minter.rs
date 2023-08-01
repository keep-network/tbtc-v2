use crate::{
    error::TbtcError,
    state::{Config, MinterIndex, MinterInfo},
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

    authority: Signer<'info>,

    #[account(
        mut,
        has_one = minter,
        close = authority,
        seeds = [MinterInfo::SEED_PREFIX, minter.key().as_ref()],
        bump = minter_info.bump,
    )]
    minter_info: Account<'info, MinterInfo>,

    // the minter info at the last index.
    // This gets its index swapped to the position of the removed minter info.
    #[account(
        mut,
        constraint = minter_info_swap.index == config.num_minters - 1,
        seeds = [MinterInfo::SEED_PREFIX, minter_info_swap.minter.as_ref()],
        bump = minter_info_swap.bump,
    )]
    minter_info_swap: Account<'info, MinterInfo>,

    // The index account of the minter to remove.
    // We replace minter_info in this with minter_info_swap.
    #[account(
        mut,
        seeds = [MinterIndex::SEED_PREFIX, &[minter_info.index]],
        bump = minter_index_swap.bump,
    )]
    minter_index_swap: Account<'info, MinterIndex>,

    // The last minter index account.
    // This gets removed, and its minter_info(_swap) gets put into minter_index_swap instead.
    #[account(
        mut,
        close = authority,
        seeds = [MinterIndex::SEED_PREFIX, &[config.num_minters - 1]],
        bump = minter_index_tail.bump,
        constraint = minter_index_tail.minter_info == minter_info_swap.key(),
    )]
    minter_index_tail: Account<'info, MinterIndex>,

    /// CHECK: Required authority to mint tokens. This pubkey lives in `MinterInfo`.
    minter: AccountInfo<'info>,
}

pub fn remove_minter(ctx: Context<RemoveMinter>) -> Result<()> {
    ctx.accounts.config.num_minters -= 1;
    Ok(())
}
