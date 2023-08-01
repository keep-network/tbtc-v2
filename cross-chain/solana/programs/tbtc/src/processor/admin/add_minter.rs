use crate::{
    error::TbtcError,
    state::{Config, MinterIndex, MinterInfo},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddMinter<'info> {
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
        space = 8 + MinterInfo::INIT_SPACE,
        seeds = [MinterInfo::SEED_PREFIX, minter.key().as_ref()],
        bump
    )]
    minter_info: Account<'info, MinterInfo>,

    #[account(
        init,
        payer = authority,
        space = 8 + MinterIndex::INIT_SPACE,
        seeds = [MinterIndex::SEED_PREFIX, &[config.num_minters]],
        bump
    )]
    minter_index: Account<'info, MinterIndex>,

    /// CHECK: Required authority to mint tokens. This pubkey lives in `MinterInfo`.
    minter: AccountInfo<'info>,

    system_program: Program<'info, System>,
}

pub fn add_minter(ctx: Context<AddMinter>) -> Result<()> {
    ctx.accounts.minter_info.set_inner(MinterInfo {
        minter: ctx.accounts.minter.key(),
        index: ctx.accounts.config.num_minters,
        bump: ctx.bumps["minter_info"],
    });

    ctx.accounts.minter_index.set_inner(MinterIndex {
        minter_info: ctx.accounts.minter_info.key(),
        bump: ctx.bumps["minter_index"],
    });

    ctx.accounts.config.num_minters += 1;
    Ok(())
}
