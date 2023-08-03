use anchor_lang::prelude::error_code;

#[error_code]
pub enum TbtcError {
    #[msg("This address is already a minter.")]
    MinterAlreadyExists = 0x10,

    #[msg("This address is not a minter.")]
    MinterNonexistent = 0x12,

    #[msg("This address is already a guardian.")]
    GuardianAlreadyExists = 0x20,

    #[msg("This address is not a guardian.")]
    GuardianNonexistent = 0x22,

    #[msg("Caller is not a guardian.")]
    SignerNotGuardian = 0x30,

    #[msg("Caller is not a minter.")]
    SignerNotMinter = 0x32,

    #[msg("Program is paused.")]
    IsPaused = 0x40,

    #[msg("Program is not paused.")]
    IsNotPaused = 0x42,

    #[msg("Not valid authority to perform this action.")]
    IsNotAuthority = 0x50,

    #[msg("Not valid pending authority to take authority.")]
    IsNotPendingAuthority = 0x52,

    #[msg("No pending authority.")]
    NoPendingAuthorityChange = 0x54,
}
