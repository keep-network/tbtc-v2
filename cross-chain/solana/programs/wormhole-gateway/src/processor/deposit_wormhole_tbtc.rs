use crate::{error::WormholeGatewayError, state::Custodian};
use anchor_lang::prelude::*;
use anchor_spl::token;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct DepositWormholeTbtc<'info> {
    /// NOTE: This account also acts as a minter for the TBTC program.
    #[account(
        mut, 
        seeds = [Custodian::SEED_PREFIX],
        bump = custodian.bump,
        has_one = wrapped_tbtc_token,
        has_one = wrapped_tbtc_mint,
        has_one = tbtc_mint,
    )]
    custodian: Account<'info, Custodian>,

    /// This token account is owned by this program, whose mint is the wrapped TBTC mint. This PDA
    /// address is stored in the custodian account.
    #[account(mut)]
    wrapped_tbtc_token: Box<Account<'info, token::TokenAccount>>,

    /// This mint is owned by the Wormhole Token Bridge program. This PDA address is stored in the
    /// custodian account.
    wrapped_tbtc_mint: Box<Account<'info, token::Mint>>,

    /// This mint is owned by the TBTC program. This PDA address is stored in the custodian account.
    #[account(mut)]
    tbtc_mint: Account<'info, token::Mint>,

    #[account(
        mut,
        token::mint = wrapped_tbtc_mint,
        token::authority = recipient
    )]
    recipient_wrapped_token: Box<Account<'info, token::TokenAccount>>,

    // Use the associated token account for the recipient.
    #[account(
        mut,
        token::mint = tbtc_mint,
        token::authority = recipient,
    )]
    recipient_token: Box<Account<'info, token::TokenAccount>>,

    /// This program requires that the owner of the TBTC token account sign for TBTC being minted
    /// into his account.
    recipient: Signer<'info>,

    /// CHECK: TBTC program requires this account.
    tbtc_config: UncheckedAccount<'info>,

    /// CHECK: TBTC program requires this account.
    tbtc_minter_info: UncheckedAccount<'info>,

    token_program: Program<'info, token::Token>,
    tbtc_program: Program<'info, tbtc::Tbtc>,
}

impl<'info> DepositWormholeTbtc<'info> {
    fn constraints(ctx: &Context<Self>, amount: u64) -> Result<()> {
        let updated_minted_amount = ctx
            .accounts
            .custodian
            .minted_amount
            .checked_add(amount)
            .ok_or(WormholeGatewayError::MintedAmountOverflow)?;
        require_gte!(
            ctx.accounts.custodian.minting_limit,
            updated_minted_amount,
            WormholeGatewayError::MintingLimitExceeded
        );

        Ok(())
    }
}

#[access_control(DepositWormholeTbtc::constraints(&ctx, amount))]
pub fn deposit_wormhole_tbtc(ctx: Context<DepositWormholeTbtc>, amount: u64) -> Result<()> {
    // First transfer wrapped tokens to custody account.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.recipient_wrapped_token.to_account_info(),
                to: ctx.accounts.wrapped_tbtc_token.to_account_info(),
                authority: ctx.accounts.recipient.to_account_info(),
            },
        ),
        amount,
    )?;

    // Account for minted amount.
    ctx.accounts.custodian.minted_amount += amount;

    let custodian = &ctx.accounts.custodian;

    // Now mint.
    tbtc::cpi::mint(
        CpiContext::new_with_signer(
            ctx.accounts.tbtc_program.to_account_info(),
            tbtc::cpi::accounts::Mint {
                mint: ctx.accounts.tbtc_mint.to_account_info(),
                config: ctx.accounts.tbtc_config.to_account_info(),
                minter_info: ctx.accounts.tbtc_minter_info.to_account_info(),
                minter: custodian.to_account_info(),
                recipient_token: ctx.accounts.recipient_token.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            &[&[Custodian::SEED_PREFIX, &[custodian.bump]]],
        ),
        amount,
    )
}
