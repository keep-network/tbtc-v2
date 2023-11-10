#![allow(clippy::result_large_err)]

pub mod constants;

pub mod error;

pub(crate) mod event;

mod processor;
pub(crate) use processor::*;

mod state;
pub use state::*;

use anchor_lang::prelude::*;

declare_id!("8H9F5JGbEMyERycwaGuzLS5MQnV7dn2wm2h6egJ3Leiu");

#[derive(Clone)]
pub struct WormholeGateway;

impl Id for WormholeGateway {
    fn id() -> Pubkey {
        ID
    }
}

#[program]
pub mod wormhole_gateway {

    use super::*;

    pub fn initialize(ctx: Context<Initialize>, minting_limit: u64) -> Result<()> {
        processor::initialize(ctx, minting_limit)
    }

    pub fn change_authority(ctx: Context<ChangeAuthority>) -> Result<()> {
        processor::change_authority(ctx)
    }

    pub fn cancel_authority_change(ctx: Context<CancelAuthorityChange>) -> Result<()> {
        processor::cancel_authority_change(ctx)
    }

    pub fn take_authority(ctx: Context<TakeAuthority>) -> Result<()> {
        processor::take_authority(ctx)
    }

    pub fn update_gateway_address(
        ctx: Context<UpdateGatewayAddress>,
        args: UpdateGatewayAddressArgs,
    ) -> Result<()> {
        processor::update_gateway_address(ctx, args)
    }

    pub fn update_minting_limit(ctx: Context<UpdateMintingLimit>, new_limit: u64) -> Result<()> {
        processor::update_minting_limit(ctx, new_limit)
    }

    pub fn receive_tbtc(ctx: Context<ReceiveTbtc>, message_hash: [u8; 32]) -> Result<()> {
        processor::receive_tbtc(ctx, message_hash)
    }

    pub fn send_tbtc_gateway(
        ctx: Context<SendTbtcGateway>,
        args: SendTbtcGatewayArgs,
    ) -> Result<()> {
        processor::send_tbtc_gateway(ctx, args)
    }

    pub fn send_tbtc_wrapped(
        ctx: Context<SendTbtcWrapped>,
        args: SendTbtcWrappedArgs,
    ) -> Result<()> {
        processor::send_tbtc_wrapped(ctx, args)
    }

    pub fn deposit_wormhole_tbtc(ctx: Context<DepositWormholeTbtc>, amount: u64) -> Result<()> {
        processor::deposit_wormhole_tbtc(ctx, amount)
    }
}
