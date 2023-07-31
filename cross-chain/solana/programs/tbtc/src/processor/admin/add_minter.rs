use crate::{
    error::TbtcError,
    state::{Tbtc, MinterInfo},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddMinter<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
    pub minter: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = MinterInfo::MAXIMUM_SIZE,
        seeds = [MinterInfo::SEED_PREFIX, tbtc.key().as_ref(), minter.key().as_ref()], bump
    )]
    pub minter_info: Account<'info, MinterInfo>,
    pub system_program: Program<'info, System>,
}

pub fn add_minter(ctx: Context<AddMinter>) -> Result<()> {
    ctx.accounts.minter_info.set_inner(MinterInfo {
        minter: ctx.accounts.minter.key(),
        bump: *ctx.bumps.get("minter_info").unwrap(),
    });

    ctx.accounts.tbtc.minters += 1;
    Ok(())
}