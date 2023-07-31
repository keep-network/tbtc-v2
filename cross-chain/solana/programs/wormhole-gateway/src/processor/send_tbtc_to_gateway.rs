use crate::{
    error::WormholeGatewayError,
    state::{Custodian, GatewayInfo},
};
use anchor_lang::prelude::*;
use anchor_spl::token;
use wormhole_anchor_sdk::token_bridge::{self, program::TokenBridge};

#[derive(Accounts)]
#[instruction(recipient_chain: u16)]
pub struct SendTbtcToGateway<'info> {
    #[account(
        seeds = [Custodian::SEED_PREFIX],
        bump = custodian.bump,
        has_one = wrapped_tbtc_mint,
        has_one = tbtc_mint,
    )]
    custodian: Account<'info, Custodian>,

    #[account(
        seeds = [GatewayInfo::SEED_PREFIX, &recipient_chain.to_le_bytes()],
        bump = gateway_info.bump,
    )]
    gateway_info: Account<'info, GatewayInfo>,

    /// Custody account.
    wrapped_tbtc_token: Account<'info, token::TokenAccount>,

    /// CHECK: This account is needed for the Token Bridge program.
    wrapped_tbtc_mint: UncheckedAccount<'info>,

    #[account(mut)]
    tbtc_mint: Account<'info, token::Mint>,

    #[account(
        mut,
        token::mint = wrapped_tbtc_mint,
        token::authority = sender
    )]
    sender_account: Account<'info, token::TokenAccount>,

    sender: Signer<'info>,

    /// Check: This account is needed for the Token Bridge program.
    token_bridge_transfer_authority: UncheckedAccount<'info>,

    token_bridge_program: Program<'info, TokenBridge>,
    token_program: Program<'info, token::Token>,
}

pub fn send_tbtc_to_gateway(
    ctx: Context<SendTbtcToGateway>,
    recipient_chain: u16,
    recipient: [u8; 32],
    amount: u64,
    arbiter_fee: u64,
    nonce: u32,
) -> Result<()> {
    require!(recipient != [0; 32], WormholeGatewayError::ZeroRecipient);
    require_gt!(amount, 0, WormholeGatewayError::ZeroAmount);

    let norm_amount = 10 * (amount / 10);
    require_gt!(norm_amount, 0, WormholeGatewayError::TruncatedZeroAmount);

    let gateway = ctx.accounts.gateway_info.gateway;

    ctx.accounts
        .wrapped_tbtc_token
        .amount
        .checked_sub(norm_amount)
        .ok_or_else(|| WormholeGatewayError::NotEnoughWrappedTbtc);

    let token_program = &ctx.accounts.token_program;

    // Burn TBTC mint.
    token::burn(
        CpiContext::new(
            token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.tbtc_mint.to_account_info(),
                from: ctx.accounts.sender_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            },
        ),
        amount,
    )?;

    // Delegate authority to Token Bridge's transfer authority.
    token::approve(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            token::Approve {
                to: ctx.accounts.wrapped_tbtc_token.to_account_info(),
                delegate: ctx
                    .accounts
                    .token_bridge_transfer_authority
                    .to_account_info(),
                authority: ctx.accounts.custodian.to_account_info(),
            },
            &[&[Custodian::SEED_PREFIX, &[ctx.accounts.custodian.bump]]],
        ),
        amount,
    )?;

    // TODO: Encode message with recipient.
    // TODO: Transfer tokens with message.

    Ok(())
}
