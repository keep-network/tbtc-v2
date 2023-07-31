use crate::{
    state::WormholeGateway,
};

use tbtc::{tbtc};

use anchor_lang::prelude::*;
use anchor_spl::token;

#[derive(Accounts)]
pub struct ReceiveTbtc<'info> {
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
    /// CHECK: the recipient doesn't need to sign the mint,
    /// and it doesn't conform to any specific rules.
    /// Validating the recipient is the minter's responsibility.
    pub recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub wormhole_gateway: Account<'info, WormholeGateway>,
}

pub fn receive_tbtc(
    ctx: Context<ReceiveTbtc>,
) -> Result <()> {
    // get balance delta

    let amount = _;

    let minted_amount = ctx.accounts.wormhole_gateway.minted_amount;
    let minting_limit = ctx.accounts.wormhole_gateway.minting_limit;

    if (minted_amount + amount > minting_limit) {
        // transfer bridge token
    } else {
        ctx.accounts.wormhole_gateway.minted_amount += amount;

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
        tbtc::mint(mint_cpi_ctx, amount)
    }
}