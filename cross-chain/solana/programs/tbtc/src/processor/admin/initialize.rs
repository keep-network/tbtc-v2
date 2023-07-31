use crate::{constants::SEED_PREFIX_TBTC_MINT, state::Tbtc};
use anchor_lang::prelude::*;
use anchor_spl::token;

#[derive(Accounts)]
pub struct Initialize<'info> {
    // Use PDA for the mint address
    // so we can sign for it from the program
    #[account(
        init,
        seeds = [SEED_PREFIX_TBTC_MINT, tbtc.key().as_ref()],
        bump,
        payer = authority,
        mint::decimals = 9,
        mint::authority = tbtc_mint,
    )]
    pub tbtc_mint: Account<'info, token::Mint>,

    #[account(init, payer = authority, space = Tbtc::MAXIMUM_SIZE)]
    pub tbtc: Account<'info, Tbtc>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, token::Token>,
    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    ctx.accounts.tbtc.set_inner(Tbtc {
        authority: ctx.accounts.authority.key(),
        token_mint: ctx.accounts.tbtc_mint.key(),
        token_bump: *ctx.bumps.get("tbtc_mint").unwrap(),
        minters: 0,
        guardians: 0,
        paused: false,
    });
    Ok(())
}
