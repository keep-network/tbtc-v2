mod constants;
pub use constants::*;

pub mod error;

mod processor;
pub(crate) use processor::*;

mod state;
pub use state::*;

use anchor_lang::prelude::*;

declare_id!("8H9F5JGbEMyERycwaGuzLS5MQnV7dn2wm2h6egJ3Leiu");

#[program]
pub mod wormhole_gateway {

    use super::*;

    pub fn initialize(ctx: Context<Initialize>, minting_limit: u64) -> Result<()> {
        processor::initialize(ctx, minting_limit)
    }

    pub fn update_gateway_address(
        ctx: Context<UpdateGatewayAddress>,
        chain_id: u16,
        gateway_address: [u8; 32],
    ) -> Result<()> {
        processor::update_gateway_address(ctx, chain_id, gateway_address)
    }

    pub fn update_minting_limit(ctx: Context<UpdateMintingLimit>, new_limit: u64) -> Result<()> {
        processor::update_minting_limit(ctx, new_limit)
    }

    // pub fn receive_tbtc(ctx: Context<ReceiveTbtc>) -> Result<()> {
    //     processor::receive_tbtc(ctx)
    // }

    pub fn send_tbtc_to_gateway(
        ctx: Context<SendTbtcToGateway>,
        recipient_chain: u16,
        recipient: [u8; 32],
        amount: u64,
        arbiter_fee: u64,
        nonce: u32,
    ) -> Result<()> {
        processor::send_tbtc_to_gateway(ctx, recipient_chain, recipient, amount, arbiter_fee, nonce)
    }

    pub fn deposit_wormhole_tbtc(ctx: Context<DepositWormholeTbtc>, amount: u64) -> Result<()> {
        processor::deposit_wormhole_tbtc(ctx, amount)
    }
}
