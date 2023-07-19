use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    // mint,
    token::{mint_to, TokenAccount, Mint as SplMint, MintTo as SplMintTo, Token as SplToken},
};

declare_id!("HksEtDgsXJV1BqcuhzbLRTmXp5gHgHJktieJCtQd3pG");

#[program]
pub mod tbtc {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let tbtc = &mut ctx.accounts.tbtc; 
        tbtc.authority = ctx.accounts.authority.key();
        tbtc.token_mint = ctx.accounts.tbtc_mint.key();
        tbtc.token_bump = *ctx.bumps.get("tbtc_mint").unwrap();
        tbtc.minters = 0;
        tbtc.guardians = 0;
        tbtc.paused = false;
        Ok(())
    }

    pub fn add_minter(ctx: Context<AddMinter>) -> Result<()> {
        let minter_info = &mut ctx.accounts.minter_info;
        minter_info.minter = ctx.accounts.minter.key();
        minter_info.bump = *ctx.bumps.get("minter_info").unwrap();

        ctx.accounts.tbtc.minters += 1;
        emit!(MinterAdded { minter: ctx.accounts.minter.key() });
        Ok(())
    }

    pub fn remove_minter(ctx: Context<RemoveMinter>, minter: Pubkey) -> Result<()> {
        // require!(ctx.accounts.tbtc.minters > 0, TbtcError::NoMinters);
        ctx.accounts.tbtc.minters -= 1;
        emit!(MinterRemoved { minter: minter });
        Ok(())
    }

    pub fn add_guardian(ctx: Context<AddGuardian>) -> Result<()> {
        let guardian_info = &mut ctx.accounts.guardian_info;
        guardian_info.guardian = ctx.accounts.guardian.key();
        guardian_info.bump = *ctx.bumps.get("guardian_info").unwrap();

        ctx.accounts.tbtc.guardians += 1;
        emit!(GuardianAdded { guardian: ctx.accounts.guardian.key() });
        Ok(())
    }

    pub fn remove_guardian(ctx: Context<RemoveGuardian>, guardian: Pubkey) -> Result<()> {
        // require!(ctx.accounts.tbtc.guardians > 0, TbtcError::NoGuardians);
        ctx.accounts.tbtc.guardians -= 1;
        emit!(GuardianRemoved { guardian: guardian });
        Ok(())
    }

    pub fn setup_mint(_ctx: Context<SetupMint>) -> Result<()> {
        msg!("setup mint complete\n\n\n");
        Ok(())
    }

    pub fn mint(ctx: Context<Mint>, amount: u64) -> Result<()> {
        msg!("start mint\n\n\n");
        let seed = b"tbtc-mint";
        let key_seed = ctx.accounts.tbtc.key();
        let mint_bump = ctx.accounts.tbtc.token_bump;
        let signer: &[&[&[u8]]] = &[&[seed, key_seed.as_ref(), &[mint_bump]]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SplMintTo {
                mint: ctx.accounts.tbtc_mint.to_account_info(),
                to: ctx.accounts.recipient_account.to_account_info(),
                authority: ctx.accounts.tbtc_mint.to_account_info(),
            },
            signer,
        );
        mint_to(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        ctx.accounts.tbtc.paused = true;
        Ok(())
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        ctx.accounts.tbtc.paused = false;
        Ok(())
    }
}

#[account]
#[derive(Default)]
pub struct Tbtc {
    authority: Pubkey,
    token_mint: Pubkey,
    token_bump: u8,
    minters: u8,
    guardians: u8,
    paused: bool,
}

#[account]
#[derive(Default)]
pub struct MinterInfo {
    minter: Pubkey,
    bump: u8,
}

#[account]
#[derive(Default)]
pub struct GuardianInfo {
    guardian: Pubkey,
    bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    // Use PDA for the mint address
    // so we can sign for it from the program
    #[account(
        init,
        seeds = [b"tbtc-mint", tbtc.key().as_ref()],
        bump,
        payer = authority,
        mint::decimals = 9,
        mint::authority = tbtc_mint,
    )]
    pub tbtc_mint: Account<'info, SplMint>,

    #[account(init, payer = authority, space = 8 + Tbtc::MAXIMUM_SIZE)]
    pub tbtc: Account<'info, Tbtc>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, SplToken>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct AddMinter<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
    pub minter: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 1,
        seeds = [b"minter-info", tbtc.key().as_ref(), minter.key().as_ref()], bump
    )]
    pub minter_info: Account<'info, MinterInfo>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(minter: Pubkey)]
pub struct RemoveMinter<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = minter_info.minter == minter,
        close = authority,
        seeds = [b"minter-info", tbtc.key().as_ref(), minter.as_ref()],
        bump = minter_info.bump,
    )]
    pub minter_info: Account<'info, MinterInfo>,
}

#[derive(Accounts)]
pub struct AddGuardian<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
    pub guardian: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 1,
        seeds = [b"guardian-info", tbtc.key().as_ref(), guardian.key().as_ref()], bump
    )]
    pub guardian_info: Account<'info, GuardianInfo>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(guardian: Pubkey)]
pub struct RemoveGuardian<'info> {
    #[account(
        mut,
        has_one = authority @ TbtcError::IsNotAuthority,
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = guardian_info.guardian == guardian,
        close = authority,
        seeds = [b"guardian-info", tbtc.key().as_ref(), guardian.as_ref()],
        bump = guardian_info.bump,
    )]
    pub guardian_info: Account<'info, GuardianInfo>,
}

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(
        mut,
        constraint = !tbtc.paused @ TbtcError::IsPaused
    )]
    pub tbtc: Account<'info, Tbtc>,
    #[account(
        has_one = guardian,
        seeds = [b"guardian-info", tbtc.key().as_ref(), guardian.key().as_ref()],
        bump = guardian_info.bump
    )]
    pub guardian_info: Account<'info, GuardianInfo>,
    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(
        mut,
        constraint = tbtc.paused @ TbtcError::IsNotPaused,
        has_one = authority @ TbtcError::IsNotAuthority
    )]
    pub tbtc: Account<'info, Tbtc>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetupMint<'info> {
    // Use the correct token mint for the program.
    #[account(
        mut,
        seeds = [b"tbtc-mint", tbtc.key().as_ref()],
        bump = tbtc.token_bump,
        mint::decimals = 9,
        mint::authority = tbtc_mint,
    )]
    pub tbtc_mint: Account<'info, SplMint>,
    pub tbtc: Account<'info, Tbtc>,

    // Set up the recipient's token account.
    #[account(
        init,
        payer = payer,
        associated_token::mint = tbtc_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_account: Account<'info, TokenAccount>,
    /// CHECK: the recipient doesn't need to sign the mint,
    /// and it doesn't conform to any specific rules.
    /// Validating the recipient is the minter's responsibility.
    pub recipient: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, SplToken>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct Mint<'info> {
    // Use the correct token mint for the program.
    #[account(
        mut,
        seeds = [b"tbtc-mint", tbtc.key().as_ref()],
        bump = tbtc.token_bump,
        mint::decimals = 9,
        mint::authority = tbtc_mint,
    )]
    pub tbtc_mint: Account<'info, SplMint>,

    // Can not mint when paused.
    #[account(
        constraint = !tbtc.paused @ TbtcError::IsPaused
    )]
    pub tbtc: Account<'info, Tbtc>,

    // Require the signing minter to match a valid minter info.
    #[account(
        has_one = minter,
        seeds = [b"minter-info", tbtc.key().as_ref(), minter.key().as_ref()],
        bump = minter_info.bump,
    )]
    pub minter_info: Account<'info, MinterInfo>,
    pub minter: Signer<'info>,

    // Use the associated token account for the recipient.
    // This account needs to be initialised first.
    #[account(
        mut,
        associated_token::mint = tbtc_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_account: Account<'info, TokenAccount>,
    /// CHECK: the recipient doesn't need to sign the mint,
    /// and it doesn't conform to any specific rules.
    /// Validating the recipient is the minter's responsibility.
    pub recipient: UncheckedAccount<'info>,

    pub token_program: Program<'info, SplToken>,
}

impl Tbtc {
    pub const MAXIMUM_SIZE: usize = 32 + 32 + 1 + 1 + 1 + 1;
}

#[error_code]
pub enum TbtcError {
    IsPaused,
    IsNotPaused,
    IsNotAuthority,
}

#[event]
pub struct MinterAdded {
    pub minter: Pubkey,
}

#[event]
pub struct MinterRemoved {
    pub minter: Pubkey,
}

#[event]
pub struct GuardianAdded {
    pub guardian: Pubkey,
}

#[event]
pub struct GuardianRemoved {
    pub guardian: Pubkey,
}
