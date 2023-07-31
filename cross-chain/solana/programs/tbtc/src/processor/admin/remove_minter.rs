use crate::{
    error::TbtcError,
    state::{Config, MinterInfo},
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

    /// CHECK: Required authority to mint tokens. This pubkey lives in `MinterInfo`.
    minter: AccountInfo<'info>,
}

pub fn remove_minter(ctx: Context<RemoveMinter>) -> Result<()> {
    ctx.accounts.config.num_minters -= 1;
    Ok(())
}
