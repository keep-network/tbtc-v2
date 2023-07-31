use crate::{
    constants::{TBTC_FOREIGN_TOKEN_ADDRESS, TBTC_FOREIGN_TOKEN_CHAIN},
    state::Custodian,
};
use anchor_lang::prelude::*;
use anchor_spl::token;
use wormhole_anchor_sdk::token_bridge;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Custodian::INIT_SPACE,
        seeds = [Custodian::SEED_PREFIX],
        bump,
    )]
    custodian: Account<'info, Custodian>,

    /// TBTC Program's mint PDA address bump is saved in this program's config. Ordinarily, we would
    /// not have to deserialize this account. But we do in this case to make sure the TBTC program
    /// has been initialized before this program.
    #[account(
        seeds = [tbtc::SEED_PREFIX_TBTC_MINT],
        bump,
        seeds::program = tbtc::ID
    )]
    tbtc_mint: Account<'info, token::Mint>,

    #[account(
        seeds = [
            token_bridge::WrappedMint::SEED_PREFIX,
            &TBTC_FOREIGN_TOKEN_CHAIN.to_be_bytes(),
            TBTC_FOREIGN_TOKEN_ADDRESS.as_ref()
        ],
        bump
    )]
    wrapped_tbtc_mint: Account<'info, token::Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = wrapped_tbtc_mint,
        token::authority = authority,
        seeds = [b"wrapped-token"],
        bump
    )]
    wrapped_tbtc_token: Account<'info, token::TokenAccount>,

    #[account(mut)]
    authority: Signer<'info>,

    system_program: Program<'info, System>,
    token_program: Program<'info, token::Token>,
}

pub fn initialize(ctx: Context<Initialize>, minting_limit: u64) -> Result<()> {
    ctx.accounts.custodian.set_inner(Custodian {
        bump: ctx.bumps["config"],
        authority: ctx.accounts.authority.key(),
        tbtc_mint: ctx.accounts.tbtc_mint.key(),
        wrapped_tbtc_mint: ctx.accounts.wrapped_tbtc_mint.key(),
        wrapped_tbtc_token: ctx.accounts.wrapped_tbtc_token.key(),
        minting_limit,
    });

    Ok(())
}
