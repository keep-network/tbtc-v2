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

// TODO:
// * Be paused by any one of `n` guardians, allowing avoidance of contagion in case
//  of a chain- or bridge-specific incident.
// * Proper documentation.
// * Misfund recovery.
contract L2TBTC is
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PermitUpgradeable,
    OwnableUpgradeable
{
    /// @notice Indicates if the given address is a Minter. Only Minters can
    ///         mint the token.
    mapping(address => bool) public isMinter;

    /// @notice List of all Minters.
    address[] public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    modifier onlyMinter() {
        require(isMinter[msg.sender], "Caller is not a minter");
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
    }

    /// @notice Adds the address to the Minter list.
    /// @dev Requirements:
    ///      - The caller must be the contract owner.
    ///      - `minter` must not be a minter address.
    function addMinter(address minter) external onlyOwner {
        require(!isMinter[minter], "This address is already a minter");
        isMinter[minter] = true;
        minters.push(minter);
        emit MinterAdded(minter);
    }

    /// @notice Removes the address from the Minter list.
    /// @dev Requirements:
    ///      - The caller must be the contract owner.
    ///      - `minter` must be a minter address.
    function removeMinter(address minter) external onlyOwner {
        require(isMinter[minter], "This address is not a minter");
        delete isMinter[minter];

        // We do not expect too many Minters so a simple loop is safe.
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

    /// @notice Allows one of the minters to mint `amount` tokens and assign
    ///         them to `account`, increasing the total supply. Emits
    ///         a `Transfer` event with `from` set to the zero address.
    /// @dev Requirements:
    ///      - The caller must be a minter.
    ///      - `account` must not be the zero address.
    function mint(address account, uint256 amount) external onlyMinter {
        _mint(account, amount);
    }

    /// @notice Allows to fetch a list of all Minters.
    function getMinters() external view returns (address[] memory) {
        return minters;
    }
}
