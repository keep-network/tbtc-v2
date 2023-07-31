use crate::{
    error::TbtcError,
    state::{Tbtc, MinterInfo},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(minter: Pubkey)]
pub struct RemoveMinter<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = minter_info.minter == minter,
        close = authority,
        seeds = [MinterInfo::SEED_PREFIX, tbtc.key().as_ref(), minter.as_ref()],
        bump = minter_info.bump,
    )]
    pub minter_info: Account<'info, MinterInfo>,
}

pub fn remove_minter(ctx: Context<RemoveMinter>, _minter: Pubkey) -> Result<()> {
    ctx.accounts.tbtc.minters -= 1;
    Ok(())
}