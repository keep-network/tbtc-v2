use crate::{error::WormholeGatewayError, state::Custodian};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct TakeAuthority<'info> {
    #[account(
        mut,
        seeds = [Custodian::SEED_PREFIX],
        bump,
    )]
    custodian: Account<'info, Custodian>,

    pending_authority: Signer<'info>,
}

impl<'info> TakeAuthority<'info> {
    fn constraints(ctx: &Context<Self>) -> Result<()> {
        match ctx.accounts.custodian.pending_authority {
            Some(pending_authority) => {
                require_keys_eq!(
                    pending_authority,
                    ctx.accounts.pending_authority.key(),
                    WormholeGatewayError::IsNotPendingAuthority
                );

                Ok(())
            }
            None => err!(WormholeGatewayError::NoPendingAuthorityChange),
        }
    }
}

#[access_control(TakeAuthority::constraints(&ctx))]
pub fn take_authority(ctx: Context<TakeAuthority>) -> Result<()> {
    ctx.accounts.custodian.authority = ctx.accounts.pending_authority.key();
    ctx.accounts.custodian.pending_authority = None;
    Ok(())
}
