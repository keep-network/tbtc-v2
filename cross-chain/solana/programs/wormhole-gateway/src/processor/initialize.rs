use crate::state::Custodian;
use anchor_lang::prelude::*;
use anchor_spl::token;
use wormhole_anchor_sdk::token_bridge;

const TBTC_FOREIGN_TOKEN_CHAIN: u8 = 2;

#[cfg(feature = "mainnet")]
const TBTC_FOREIGN_TOKEN_ADDRESS: [u8; 32] = [
    0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x8d, 0xae, 0xba, 0xde, 0x92, 0x2d,
    0xf7, 0x35, 0xc3, 0x8c, 0x80, 0xc7, 0xeb, 0xd7, 0x08, 0xaf, 0x50, 0x81, 0x5f, 0xaa,
];

/// TODO: Fix this to reflect testnet contract address.
#[cfg(feature = "solana-devnet")]
const TBTC_FOREIGN_TOKEN_ADDRESS: [u8; 32] = [
    0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x8d, 0xae, 0xba, 0xde, 0x92, 0x2d,
    0xf7, 0x35, 0xc3, 0x8c, 0x80, 0xc7, 0xeb, 0xd7, 0x08, 0xaf, 0x50, 0x81, 0x5f, 0xaa,
];

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    authority: Signer<'info>,

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

    /// CHECK: This account is needed for the Token Bridge program. This PDA is specifically used to
    /// sign for transferring via Token Bridge program with a message.
    #[account(
        seeds = [token_bridge::SEED_PREFIX_SENDER],
        bump,
    )]
    token_bridge_sender: AccountInfo<'info>,

    /// CHECK: This account is needed for the Token Bridge program. This PDA is specifically used to
    /// sign for transferring via Token Bridge program with a message.
    #[account(
        seeds = [token_bridge::SEED_PREFIX_REDEEMER],
        bump,
    )]
    token_bridge_redeemer: AccountInfo<'info>,

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
        token_bridge_sender: ctx.accounts.token_bridge_sender.key(),
        token_bridge_sender_bump: ctx.bumps["token_bridge_sender"],
        token_bridge_redeemer: ctx.accounts.token_bridge_sender.key(),
        token_bridge_redeemer_bump: ctx.bumps["token_bridge_redeemer"],
        minting_limit,
    });

    Ok(())
}
