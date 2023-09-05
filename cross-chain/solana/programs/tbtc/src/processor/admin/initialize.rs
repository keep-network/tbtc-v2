use crate::{
    constants::SEED_PREFIX_TBTC_MINT,
    state::{Config, Guardians, Minters},
};
use anchor_lang::prelude::*;
use anchor_spl::{metadata, token};

#[derive(Accounts)]
pub struct Initialize<'info> {
    // Use PDA for the mint address
    // so we can sign for it from the program
    #[account(
        init,
        seeds = [SEED_PREFIX_TBTC_MINT],
        bump,
        payer = authority,
        mint::decimals = 8,
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

    #[account(
        init,
        payer = authority,
        space = Guardians::compute_size(0),
        seeds = [Guardians::SEED_PREFIX],
        bump,
    )]
    guardians: Account<'info, Guardians>,

    #[account(
        init,
        payer = authority,
        space = Minters::compute_size(0),
        seeds = [Minters::SEED_PREFIX],
        bump,
    )]
    minters: Account<'info, Minters>,

    #[account(mut)]
    authority: Signer<'info>,

    /// CHECK: This account is needed for the MPL Token Metadata program.
    #[account(mut)]
    tbtc_metadata: UncheckedAccount<'info>,

    /// CHECK: This account is needed for the MPL Token Metadata program.
    rent: UncheckedAccount<'info>,

    mpl_token_metadata_program: Program<'info, metadata::Metadata>,
    token_program: Program<'info, token::Token>,
    system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    // Set Config account data.
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

    // Set Guardians account data with empty vec.
    ctx.accounts.guardians.set_inner(Guardians {
        bump: ctx.bumps["guardians"],
        keys: Vec::new(),
    });

    // Set Guardians account data with empty vec.
    ctx.accounts.minters.set_inner(Minters {
        bump: ctx.bumps["minters"],
        keys: Vec::new(),
    });

    // Create metadata for tBTC.
    metadata::create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.mpl_token_metadata_program.to_account_info(),
            metadata::CreateMetadataAccountsV3 {
                metadata: ctx.accounts.tbtc_metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.config.to_account_info(),
                payer: ctx.accounts.authority.to_account_info(),
                update_authority: ctx.accounts.config.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &[&[Config::SEED_PREFIX, &[ctx.bumps["config"]]]],
        ),
        mpl_token_metadata::state::DataV2 {
            symbol: "tBTC".to_string(),
            name: "tBTC v2".to_string(),
            uri: "".to_string(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        true,
        true,
        None,
    )
}
