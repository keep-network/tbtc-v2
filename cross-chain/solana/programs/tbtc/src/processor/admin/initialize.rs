use crate::{constants::SEED_PREFIX_TBTC_MINT, state::Config};
use anchor_lang::prelude::*;
use anchor_spl::token;

#[derive(Accounts)]
pub struct Initialize<'info> {
    // Use PDA for the mint address
    // so we can sign for it from the program
    #[account(
        init,
        seeds = [SEED_PREFIX_TBTC_MINT],
        bump,
        payer = authority,
        mint::decimals = 9,
        mint::authority = config,
    )]
    mint: Account<'info, token::Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    config: Account<'info, Config>,

    #[account(mut)]
    authority: Signer<'info>,

    token_program: Program<'info, token::Token>,
    system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    ctx.accounts.config.set_inner(Config {
        bump: ctx.bumps["config"],
        authority: ctx.accounts.authority.key(),
        pending_authority: None,
        mint: ctx.accounts.mint.key(),
        mint_bump: ctx.bumps["mint"],
        num_minters: 0,
        num_guardians: 0,
        paused: false,
    });
    Ok(())
}
