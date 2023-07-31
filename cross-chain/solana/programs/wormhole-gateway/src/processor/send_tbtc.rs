use crate::{
    state::{GatewayInfo, WormholeGateway},
};

use tbtc::{tbtc};

use anchor_lang::prelude::*;
use anchor_spl::token;

#[derive(Accounts)]
#[instruction(recipient_chain: u16)]
pub struct SendTbtc<'info> {
    #[account(
        mut,
        seeds = [tbtc::SEED_PREFIX_TBTC_MINT, tbtc.key().as_ref()],
        bump,
        mint::decimals = 9,
        mint::authority = tbtc_mint,
    )]
    pub tbtc_mint: Account<'info, token::Mint>,
    pub tbtc: Account<'info, tbtc::Tbtc>,

    pub wormhole_gateway: Account<'info, WormholeGateway>,

    pub wormhole_token_bridge: Account<'info, _>,
    pub wormhole_bridge_token_mint: Account<'info, token::Mint>,

    #[account(
        seeds = [GatewayInfo::SEED_PREFIX, wormhole_gateway.key().as_ref(), recipient_chain],
        bump = gateway_info.bump,
    )]
    pub gateway_info: Account<'info, GatewayInfo>,

    pub sender_account: Account<'info, token::TokenAccount>,
    pub sender: Signer<'info>,

    pub token_program: Program<'info, token::Token>,
}

pub fn send_tbtc(
    ctx: Context<SendTbtc>,
    amount: u64,
    recipient_chain: u16,
    arbiter_fee: u64,
    nonce: u32,
) -> Result<()> {
    let normalized_amount = normalize(amount);

    let gateway = ctx.accounts.gateway_info.gateway;

    ctx.accounts.wormhole_gateway.minted_amount -= normalized_amount;

    let seed_prefix = WormholeGateway::SEED_PREFIX;
    let key_seed = ctx.accounts.wormhole_gateway.key();
    let gateway_bump = ctx.accounts.wormhole_gateway.self_bump;

    let signer: &[&[&[u8]]] = &[&[seed_prefix, key_seed.as_ref(), &[gateway_bump]]];

    let burn_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::Burn {
            mint: ctx.accounts.tbtc_mint.to_account_info(),
            from: ctx.accounts.sender_account.to_account_info(),
            authority: ctx.accounts.wormhole_gateway.to_account_info(),
        },
        signer,
    );
    token::burn(burn_cpi_ctx, amount)


    // approve bridge token
    // transfer tokens
}

fn normalize(amount: u64) -> u64 {
    let divAmount = amount / 10;
    let normAmount = divAmount * 10;
    normAmount
}