mod constants;
pub use constants::*;

pub mod error;

mod processor;
pub(crate) use processor::*;

mod state;
pub use state::*;

use anchor_lang::prelude::*;

declare_id!("HksEtDgsXJV1BqcuhzbLRTmXp5gHgHJktieJCtQd3pG");

#[program]
pub mod tbtc {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        processor::initialize(ctx)
    }

    pub fn change_authority(ctx: Context<ChangeAuthority>) -> Result<()> {
        processor::change_authority(ctx)
    }

    pub fn add_minter(ctx: Context<AddMinter>) -> Result<()> {
        processor::add_minter(ctx)
    }

    pub fn remove_minter(ctx: Context<RemoveMinter>, minter: Pubkey) -> Result<()> {
        processor::remove_minter(ctx, minter)
    }

    pub fn add_guardian(ctx: Context<AddGuardian>) -> Result<()> {
        processor::add_guardian(ctx)
    }

    pub fn remove_guardian(ctx: Context<RemoveGuardian>, guardian: Pubkey) -> Result<()> {
        processor::remove_guardian(ctx, guardian)
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        processor::pause(ctx)
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        processor::unpause(ctx)
    }

    pub fn mint(ctx: Context<Mint>, amount: u64) -> Result<()> {
        processor::mint(ctx, amount)
    }
}
