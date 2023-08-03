use crate::state::Custodian;
use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token;
use wormhole_anchor_sdk::{
    token_bridge::{self, program::TokenBridge},
    wormhole::{self as core_bridge, program::Wormhole as CoreBridge},
};

#[derive(Accounts)]
#[instruction(args: SendTbtcWrappedArgs)]
pub struct SendTbtcWrapped<'info> {
    #[account(
        seeds = [Custodian::SEED_PREFIX],
        bump = custodian.bump,
        has_one = wrapped_tbtc_token,
        has_one = wrapped_tbtc_mint,
        has_one = tbtc_mint,
    )]
    custodian: Account<'info, Custodian>,

    /// Custody account.
    wrapped_tbtc_token: Box<Account<'info, token::TokenAccount>>,

    /// CHECK: This account is needed for the Token Bridge program.
    wrapped_tbtc_mint: UncheckedAccount<'info>,

    #[account(mut)]
    tbtc_mint: Box<Account<'info, token::Mint>>,

    #[account(
        mut,
        token::mint = tbtc_mint,
        token::authority = sender
    )]
    sender_token: Box<Account<'info, token::TokenAccount>>,

    #[account(mut)]
    sender: Signer<'info>,

    /// CHECK: This account is needed for the Token Bridge program.
    token_bridge_config: UncheckedAccount<'info>,

    /// CHECK: This account is needed for the Token Bridge program.
    token_bridge_wrapped_asset: UncheckedAccount<'info>,

    /// CHECK: This account is needed for the Token Bridge program.
    token_bridge_transfer_authority: UncheckedAccount<'info>,

    /// CHECK: This account is needed for the Token Bridge program.
    #[account(mut)]
    core_bridge: UncheckedAccount<'info>,

    /// CHECK: This account is needed for the Token Bridge program.
    #[account(
        mut,
        seeds = [b"msg", &core_emitter_sequence.value().to_le_bytes()],
        bump,
    )]
    core_message: AccountInfo<'info>,

    /// CHECK: This account is needed for the Token Bridge program.
    token_bridge_core_emitter: UncheckedAccount<'info>,

    /// CHECK: This account is needed for the Token Bridge program.
    #[account(mut)]
    core_emitter_sequence: Account<'info, core_bridge::SequenceTracker>,

    /// CHECK: This account is needed for the Token Bridge program.
    #[account(mut)]
    core_fee_collector: UncheckedAccount<'info>,

    /// CHECK: This account is needed for the Token Bridge program.
    clock: UncheckedAccount<'info>,

    /// CHECK: This account is needed for the Token Bridge program.
    rent: UncheckedAccount<'info>,

    token_bridge_program: Program<'info, TokenBridge>,
    core_bridge_program: Program<'info, CoreBridge>,
    token_program: Program<'info, token::Token>,
    system_program: Program<'info, System>,
}

impl<'info> SendTbtcWrapped<'info> {
    fn constraints(ctx: &Context<Self>, args: &SendTbtcWrappedArgs) -> Result<()> {
        super::validate_send(
            &ctx.accounts.wrapped_tbtc_token,
            &args.recipient,
            args.amount,
        )
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SendTbtcWrappedArgs {
    amount: u64,
    recipient_chain: u16,
    recipient: [u8; 32],
    arbiter_fee: u64,
    nonce: u32,
}

#[access_control(SendTbtcWrapped::constraints(&ctx, &args))]
pub fn send_tbtc_wrapped(ctx: Context<SendTbtcWrapped>, args: SendTbtcWrappedArgs) -> Result<()> {
    let SendTbtcWrappedArgs {
        amount,
        recipient_chain,
        recipient,
        arbiter_fee,
        nonce,
    } = args;

    let sender = &ctx.accounts.sender;
    let custodian = &ctx.accounts.custodian;
    let wrapped_tbtc_token = &ctx.accounts.wrapped_tbtc_token;
    let token_bridge_transfer_authority = &ctx.accounts.token_bridge_transfer_authority;
    let token_program = &ctx.accounts.token_program;

    // Prepare for wrapped tBTC transfer.
    let amount = super::burn_and_prepare_transfer(
        super::PrepareTransfer {
            custodian,
            tbtc_mint: &ctx.accounts.tbtc_mint,
            sender_token: &ctx.accounts.sender_token,
            sender,
            wrapped_tbtc_token,
            token_bridge_transfer_authority,
            token_program,
        },
        amount,
    )?;

    // Because the wormhole-anchor-sdk does not support relayable transfers (i.e. payload ID == 1),
    // we need to construct the instruction from scratch and invoke it.
    let ix = solana_program::instruction::Instruction {
        program_id: ctx.accounts.token_bridge_program.key(),
        accounts: vec![
            AccountMeta::new(sender.key(), true),
            AccountMeta::new_readonly(ctx.accounts.token_bridge_config.key(), false),
            AccountMeta::new(wrapped_tbtc_token.key(), false),
            AccountMeta::new_readonly(custodian.key(), false),
            AccountMeta::new(ctx.accounts.wrapped_tbtc_mint.key(), false),
            AccountMeta::new_readonly(ctx.accounts.token_bridge_wrapped_asset.key(), false),
            AccountMeta::new_readonly(token_bridge_transfer_authority.key(), false),
            AccountMeta::new(ctx.accounts.core_bridge.key(), false),
            AccountMeta::new(ctx.accounts.core_message.key(), true),
            AccountMeta::new_readonly(ctx.accounts.token_bridge_core_emitter.key(), false),
            AccountMeta::new(ctx.accounts.core_emitter_sequence.key(), false),
            AccountMeta::new(ctx.accounts.core_fee_collector.key(), false),
            AccountMeta::new_readonly(ctx.accounts.clock.key(), false),
            AccountMeta::new_readonly(ctx.accounts.rent.key(), false),
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
            AccountMeta::new_readonly(ctx.accounts.core_bridge_program.key(), false),
            AccountMeta::new_readonly(token_program.key(), false),
        ],
        data: token_bridge::Instruction::TransferWrapped {
            batch_id: nonce,
            amount,
            fee: arbiter_fee,
            recipient_address: recipient,
            recipient_chain,
        }
        .try_to_vec()?,
    };

    solana_program::program::invoke_signed(
        &ix,
        &ctx.accounts.to_account_infos(),
        &[
            &[Custodian::SEED_PREFIX, &[custodian.bump]],
            &[
                b"msg",
                &ctx.accounts.core_emitter_sequence.value().to_le_bytes(),
                &[ctx.bumps["core_message"]],
            ],
        ],
    )
    .map_err(Into::into)
}
