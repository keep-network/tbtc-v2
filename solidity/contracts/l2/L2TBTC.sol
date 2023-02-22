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

// EIP-2612 is Final as of 2022-11-01. This file is deprecated in the `main`
// branch of @openzeppelin/contracts-upgradeable. Once a version > 4.8.1 gets
// released, we should drop the `draft-*` prefix from this import.
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// TODO:
// * Be paused by any one of `n` guardians, allowing avoidance of contagion in case
//  of a chain- or bridge-specific incident.
// * Mint by minter.
// * Proper documentation.
// * Test initialization
contract L2TBTC is ERC20PermitUpgradeable, OwnableUpgradeable {
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
        __Ownable_init();
        __ERC20_init(_name, _symbol);
        __ERC20Permit_init(_name);
    }

    /// @notice Adds the address to the Minter list.
    function addMinter(address minter) external onlyOwner {
        require(!isMinter[minter], "This address is already a minter");
        isMinter[minter] = true;
        minters.push(minter);
        emit MinterAdded(minter);
    }

    /// @notice Removes the address from the Minter list.
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

    /// @notice Allows to fetch a list of all Minters.
    function getMinters() external view returns (address[] memory) {
        return minters;
    }
}
