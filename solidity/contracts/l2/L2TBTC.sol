// SPDX-License-Identifier: GPL-3.0-only

// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌

pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// TODO:
// * Proper documentation.
// * Misfund recovery.
contract L2TBTC is
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PermitUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    /// @notice Indicates if the given address is a minter. Only minters can
    ///         mint the token.
    mapping(address => bool) public isMinter;

    /// @notice List of all minters.
    address[] public minters;

    /// @notice Indicates if the given address is a guardian. Only guardians can
    ///         pause token mints and burns.
    mapping(address => bool) public isGuardian;

    /// @notice List of all guardians.
    address[] public guardians;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);

    modifier onlyMinter() {
        require(isMinter[msg.sender], "Caller is not a minter");
        _;
    }

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "Caller is not a guardian");
        _;
    }

    function initialize(string memory _name, string memory _symbol)
        external
        initializer
    {
        // OpenZeppelin upgradeable contracts documentation says:
        //
        // "Use with multiple inheritance requires special care. Initializer
        // functions are not linearized by the compiler like constructors.
        // Because of this, each __{ContractName}_init function embeds the
        // linearized calls to all parent initializers. As a consequence,
        // calling two of these init functions can potentially initialize the
        // same contract twice."
        //
        // Note that ERC20 extensions do not linearize calls to ERC20Upgradeable
        // initializer so we call all extension initializers individually. At
        // the same time, ERC20PermitUpgradeable does linearize the call to
        // EIP712Upgradeable so we are not using the unchained initializer
        // versions.
        __ERC20_init(_name, _symbol);
        __ERC20Burnable_init();
        __ERC20Permit_init(_name);
        __Ownable_init();
        __Pausable_init();
    }

    /// @notice Adds the address to the minters list.
    /// @dev Requirements:
    ///      - The caller must be the contract owner.
    ///      - `minter` must not be a minter address already.
    function addMinter(address minter) external onlyOwner {
        require(!isMinter[minter], "This address is already a minter");
        isMinter[minter] = true;
        minters.push(minter);
        emit MinterAdded(minter);
    }

    /// @notice Removes the address from the minters list.
    /// @dev Requirements:
    ///      - The caller must be the contract owner.
    ///      - `minter` must be a minter address.
    function removeMinter(address minter) external onlyOwner {
        require(isMinter[minter], "This address is not a minter");
        delete isMinter[minter];

        // We do not expect too many minters so a simple loop is safe.
        for (uint256 i = 0; i < minters.length; i++) {
            if (minters[i] == minter) {
                minters[i] = minters[minters.length - 1];
                // slither-disable-next-line costly-loop
                minters.pop();
                break;
            }
        }

        emit MinterRemoved(minter);
    }

    /// @notice Adds the address to the guardians list.
    /// @dev Requirements:
    ///      - The caller must be the contract owner.
    ///      - `guardian` must not be a guardian address already.
    function addGuardian(address guardian) external onlyOwner {
        require(!isGuardian[guardian], "This address is already a guardian");
        isGuardian[guardian] = true;
        guardians.push(guardian);
        emit GuardianAdded(guardian);
    }

    /// @notice Removes the address from the guardians list.
    /// @dev Requirements:
    ///      - The caller must be the contract owner.
    ///      - `guardian` must be a guardian address.
    function removeGuardian(address guardian) external onlyOwner {
        require(isGuardian[guardian], "This address is not a guardian");
        delete isGuardian[guardian];

        // We do not expect too many guardians so a simple loop is safe.
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == guardian) {
                guardians[i] = guardians[guardians.length - 1];
                // slither-disable-next-line costly-loop
                guardians.pop();
                break;
            }
        }

        emit GuardianRemoved(guardian);
    }

    /// @notice Allows one of the guardians to pause mints and burns allowing
    ///         avoidance of contagion in case of a chain- or bridge-specific
    ///         incident.
    /// @dev Requirements:
    ///      - The caller must be a guardian.
    ///      - The contract must not be already paused.
    function pause() external onlyGuardian {
        _pause();
    }

    /// @notice Allows the governance to unpause mints and burns previously
    ///         paused by one of the guardians.
    /// @dev Requirements:
    ///      - The caller must be the contract owner.
    ///      - The contract must be paused.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Allows one of the minters to mint `amount` tokens and assign
    ///         them to `account`, increasing the total supply. Emits
    ///         a `Transfer` event with `from` set to the zero address.
    /// @dev Requirements:
    ///      - The caller must be a minter.
    ///      - `account` must not be the zero address.
    function mint(address account, uint256 amount)
        external
        whenNotPaused
        onlyMinter
    {
        _mint(account, amount);
    }

    /// @notice Destroys `amount` tokens from the caller. Emits a `Transfer`
    ///         event with `to` set to the zero address.
    /// @dev Requirements:
    ///      - The caller must have at least `amount` tokens.
    function burn(uint256 amount) public override whenNotPaused {
        super.burn(amount);
    }

    /// @notice Destroys `amount` tokens from `account`, deducting from the
    ///         caller's allowance. Emits a `Transfer` event with `to` set to
    ///         the zero address.
    /// @dev Requirements:
    ///      - The che caller must have allowance for `accounts`'s tokens of at
    ///        least `amount`.
    ///      - `account` must not be the zero address.
    ///      - `account` must have at least `amount` tokens.
    function burnFrom(address account, uint256 amount)
        public
        override
        whenNotPaused
    {
        super.burnFrom(account, amount);
    }

    /// @notice Allows to fetch a list of all minters.
    function getMinters() external view returns (address[] memory) {
        return minters;
    }

    /// @notice Allows to fetch a list of all guardians.
    function getGuardians() external view returns (address[] memory) {
        return guardians;
    }
}
