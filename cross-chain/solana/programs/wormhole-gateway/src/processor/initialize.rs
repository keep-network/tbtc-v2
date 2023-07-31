use crate::{
    state::WormholeGateway,
};

use anchor_lang::prelude::*;
use anchor_spl::token;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        seeds = [SEED_PREFIX_TBTC_MINT, tbtc.key().as_ref()],
        bump,
        mint::decimals = 9,
        mint::authority = tbtc_mint,
    )]
    pub tbtc_mint: Account<'info, token::Mint>,
    pub tbtc: Account<'info, tbtc::Tbtc>,

    #[account(
        init, payer = authority, space = WormholeGateway::MAXIMUM_SIZE
    )]
    pub wormhole_gateway: Account<'info, WormholeGateway>,

    pub wormhole_token_bridge: Account<'info, _>,
    pub wormhole_bridge_token_mint: Account<'info, token::Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, token::Token>,
    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>, minting_limit: u64) -> Result<()> {
    ctx.accounts.wormhole_gateway.set_inner(WormholeGateway {
        authority: ctx.accounts.authority.key(),
        wormhole_token_bridge: ctx.accounts.wormhole_token_bridge.key(),
        wormhole_bridge_token_mint: ctx.accounts.wormhole_bridge_token_mint.key(),
        tbtc: ctx.accounts.tbtc.key(),
        tbtc_mint: ctx.accounts.tbtc_mint.key(),
        minting_limit: minting_limit,
        minted_amount: 0,
        self_bump: ctx.bumps.get("wormhole_gateway").unwrap(),
    });
    Ok(())
}