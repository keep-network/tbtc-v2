use crate::{error::WormholeGatewayError, state::Custodian};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ChangeAuthority<'info> {
    #[account(
        mut,
        seeds = [Custodian::SEED_PREFIX],
        bump,
        has_one = authority @ WormholeGatewayError::IsNotAuthority
    )]
    custodian: Account<'info, Custodian>,

    authority: Signer<'info>,

    /// CHECK: New authority.
    new_authority: AccountInfo<'info>,
}

pub fn change_authority(ctx: Context<ChangeAuthority>) -> Result<()> {
    ctx.accounts.custodian.pending_authority = Some(ctx.accounts.new_authority.key());
    Ok(())
}
