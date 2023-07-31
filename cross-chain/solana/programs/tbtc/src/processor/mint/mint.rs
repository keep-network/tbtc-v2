use crate::{
    constants::SEED_PREFIX_TBTC_MINT,
    error::TbtcError,
    state::{Tbtc, MinterInfo},
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token,
};

#[derive(Accounts)]
pub struct Mint<'info> {
    // Use the correct token mint for the program.
    #[account(
        mut,
        seeds = [SEED_PREFIX_TBTC_MINT, tbtc.key().as_ref()],
        bump = tbtc.token_bump,
        mint::decimals = 9,
        mint::authority = tbtc_mint,
    )]
    pub tbtc_mint: Account<'info, token::Mint>,

    // Can not mint when paused.
    #[account(
        constraint = !tbtc.paused @ TbtcError::IsPaused
    )]
    pub tbtc: Account<'info, Tbtc>,

    // Require the signing minter to match a valid minter info.
    #[account(
        has_one = minter,
        seeds = [MinterInfo::SEED_PREFIX, tbtc.key().as_ref(), minter.key().as_ref()],
        bump = minter_info.bump,
    )]
    pub minter_info: Account<'info, MinterInfo>,
    pub minter: Signer<'info>,

    // Use the associated token account for the recipient.
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = tbtc_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_account: Account<'info, token::TokenAccount>,
    /// CHECK: the recipient doesn't need to sign the mint,
    /// and it doesn't conform to any specific rules.
    /// Validating the recipient is the minter's responsibility.
    pub recipient: UncheckedAccount<'info>,

    #[account(
        mut,
    )]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, token::Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn mint(ctx: Context<Mint>, amount: u64) -> Result<()> {
    let seed_prefix = SEED_PREFIX_TBTC_MINT;
    let key_seed = ctx.accounts.tbtc.key();
    let mint_bump = ctx.accounts.tbtc.token_bump;
    let signer: &[&[&[u8]]] = &[&[seed_prefix, key_seed.as_ref(), &[mint_bump]]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::MintTo {
            mint: ctx.accounts.tbtc_mint.to_account_info(),
            to: ctx.accounts.recipient_account.to_account_info(),
            authority: ctx.accounts.tbtc_mint.to_account_info(),
        },
        signer,
    );
    token::mint_to(cpi_ctx, amount)
}