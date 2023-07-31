use crate::{
    error::WormholeGatewayError,
    state::WormholeGateway,
};
use tbtc::{tbtc};

use anchor_lang::prelude::*;
use anchor_spl::token;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct DepositWormholeTbtc<'info> {
    #[account(mut)]
    pub tbtc_mint: Account<'info, token::Mint>,
    pub tbtc: Account<'info, tbtc::Tbtc>,
    pub minter_info: Account<'info, tbtc::MinterInfo>,

    // Use the associated token account for the recipient.
    #[account(
        associated_token::mint = tbtc_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_account: Account<'info, token::TokenAccount>,
    pub recipient: Signer<'info>,
    #[account(
        constraint = wormhole_gateway.minting_limit > wormhole_gateway.minted_amount + amount @ WormholeGatewayError::MintingLimitExceeded
    )]
    pub wormhole_gateway: Account<'info, WormholeGateway>,
}

pub fn deposit_wormhole_tbtc(
    ctx: Context<DepositWormholeTbtc>,
    amount: u64,
) -> Result<()> {
    ctx.accounts.wormhole_gateway.minted_amount += amount;

    let transfer_cpi_ctx = CpiContext::new_with_signer(
        //
    );
    // wormhole::transfer

    let seed_prefix = WormholeGateway::SEED_PREFIX;
    let key_seed = ctx.accounts.wormhole_gateway.key();
    let gateway_bump = ctx.accounts.wormhole_gateway.self_bump;

    let signer: &[&[&[u8]]] = &[&[seed_prefix, key_seed.as_ref(), &[gateway_bump]]];

    let mint_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.tbtc.to_account_info(),
        tbtc::Mint {
            tbtc_mint: ctx.accounts.tbtc_mint.to_account_info(),
            tbtc: ctx.accounts.tbtc.to_account_info(),
            minter_info: ctx.accounts.minter_info.to_account_info(),
            minter: ctx.accounts.wormhole_gateway.to_account_info(),
            recipient_account: ctx.accounts.recipient_account.to_account_info(),
            recipient: ctx.accounts.recipient.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
        },
        signer,
    );
    tbtc::mint(mint_cpi_ctx, amount);
}