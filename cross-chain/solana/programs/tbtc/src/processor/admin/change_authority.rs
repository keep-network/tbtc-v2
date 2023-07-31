use crate::{
    error::TbtcError,
    state::{Tbtc},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ChangeAuthority<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub new_authority: Signer<'info>,
}

pub fn change_authority(ctx: Context<ChangeAuthority>) -> Result<()> {
    ctx.accounts.tbtc.authority = ctx.accounts.new_authority.key();
    Ok(())
}