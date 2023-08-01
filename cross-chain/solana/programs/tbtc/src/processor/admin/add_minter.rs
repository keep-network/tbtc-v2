use crate::{
    error::TbtcError,
    state::{Config, MinterInfo},
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

    /// CHECK: Required authority to mint tokens. This pubkey lives in `MinterInfo`.
    minter: AccountInfo<'info>,

    system_program: Program<'info, System>,
}

pub fn add_minter(ctx: Context<AddMinter>) -> Result<()> {
    ctx.accounts.minter_info.set_inner(MinterInfo {
        minter: ctx.accounts.minter.key(),
        bump: ctx.bumps["minter_info"],
    });

    ctx.accounts.config.num_minters += 1;
    Ok(())
}
