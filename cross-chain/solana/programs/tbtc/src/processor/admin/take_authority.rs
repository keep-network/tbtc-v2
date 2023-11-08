use crate::{error::TbtcError, state::Config};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct TakeAuthority<'info> {
    #[account(
        mut,
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    config: Account<'info, Config>,

    pending_authority: Signer<'info>,
}

impl<'info> TakeAuthority<'info> {
    fn constraints(ctx: &Context<Self>) -> Result<()> {
        match ctx.accounts.config.pending_authority {
            Some(pending_authority) => {
                require_keys_eq!(
                    pending_authority,
                    ctx.accounts.pending_authority.key(),
                    TbtcError::IsNotPendingAuthority
                );

                Ok(())
            }
            None => err!(TbtcError::NoPendingAuthorityChange),
        }
    }
}

#[access_control(TakeAuthority::constraints(&ctx))]
pub fn take_authority(ctx: Context<TakeAuthority>) -> Result<()> {
    ctx.accounts.config.authority = ctx.accounts.pending_authority.key();
    ctx.accounts.config.pending_authority = None;
    Ok(())
}
