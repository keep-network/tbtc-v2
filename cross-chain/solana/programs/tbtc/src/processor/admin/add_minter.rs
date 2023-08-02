use crate::{
    error::TbtcError,
    state::{Config, MinterInfo, Minters},
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
        mut,
        seeds = [Minters::SEED_PREFIX],
        bump = minters.bump,
        realloc = Minters::compute_size(minters.keys.len() + 1),
        realloc::payer = authority,
        realloc::zero = true,
    )]
    minters: Account<'info, Minters>,

    #[account(
        init,
        payer = authority,
        space = 8 + MinterInfo::INIT_SPACE,
        seeds = [MinterInfo::SEED_PREFIX, minter.key().as_ref()],
        bump
    )]
    minter_info: Account<'info, MinterInfo>,

    /// CHECK: Required authority to mint tokens. This pubkey lives in `MinterInfo`.
    minter: AccountInfo<'info>,

    system_program: Program<'info, System>,
}

pub fn add_minter(ctx: Context<AddMinter>) -> Result<()> {
    let minter = ctx.accounts.minter.key();

    // Set account data.
    ctx.accounts.minter_info.set_inner(MinterInfo {
        bump: ctx.bumps["minter_info"],
        minter,
    });

    // Push pubkey to minters account.
    ctx.accounts.minters.push(minter);

    // Update config.
    ctx.accounts.config.num_minters += 1;

    emit!(crate::event::MinterAdded { minter });

    Ok(())
}
