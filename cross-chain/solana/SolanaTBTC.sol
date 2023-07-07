import './solana-library/spl_token.sol';
import 'solana';

contract SolanaTBTC {
    /// @notice Indicates if the given address is a minter. Only minters can
    ///         mint the token.
    mapping(address => bool) isMinter;

    /// @notice List of all minters.
    address[] minters;

    /// @notice owner
    address authority;

    /// @notice mint account
    /// @dev Stores information about the token itself. E.g. current supply and 
    ///      its authorities
    address mint;

    event MinterAdded(address minter);
    event MinterRemoved(address minter);

    modifier needs_authority() {
        for (uint64 i = 0; i < tx.accounts.length; i++) {
            AccountInfo ai = tx.accounts[i];
            if (ai.key == authority && ai.is_signer) {
                _;
                return;
            }
        }

        print("Not signed by authority");
        revert("Not signed by authority");
    }

    modifier minter_only() {
        for (uint64 i = 0; i < tx.accounts.length; i++) {
            AccountInfo ai = tx.accounts[i];
            print("checking if a minter");
            if (isMinter[ai.key] && ai.is_signer) {
                _;
                return;
            }
        }

        print("Not a minter");
        revert("Not a minter");
    }

    constructor(address initial_authority) {
        authority = initial_authority;
    }

    /// @notice Adds the address to the minters list.
    /// @dev Requirements:
    ///      - The caller must have authority.
    ///      - `minter` must not be a minter address already.
    /// @param minter The address to be added as a minter. This address can mint
    ///               SolanaTBTC token.
    function add_minter(address minter) needs_authority public {
        print("adding a minter...");
        require(!isMinter[minter], "This address is already a minter");
        isMinter[minter] = true;
        minters.push(minter);
        emit MinterAdded(minter);
        print("added a minter...");
    }

    /// @notice Removes the address from the minters list.
    /// @dev Requirements:
    ///      - The caller must have authority.
    ///      - `minter` must be a minter address.
    /// @param minter The address to be removed from the minters list.
    function remove_minter(address minter) public needs_authority {
        require(isMinter[minter], "This address is not a minter");
        delete isMinter[minter];

        // We do not expect too many minters so a simple loop is safe.
        for (uint256 i = 0; i < minters.length; i++) {
            if (minters[i] == minter) {
                minters[i] = minters[minters.length - 1];
                minters.pop();
                break;
            }
        }

        emit MinterRemoved(minter);
    }

    function set_mint(address _mint) needs_authority public {
        mint = _mint;
    }

    function mint_to(address account, address _authority, uint64 amount) minter_only public {
        print("yo, I'm in mint_to");
        SplToken.mint_to(mint, account, _authority, amount);
    }

    function total_supply() public view returns (uint64) {
        return SplToken.total_supply(mint);
    }

    function get_balance(address account) public view returns (uint64) {
        return SplToken.get_balance(account);
    }

    function transfer(address from, address to, address owner, uint64 amount) public {
        SplToken.transfer(from, to, owner, amount);
    }

    function burn(address account, address owner, uint64 amount) public {
        SplToken.burn(account, mint, owner, amount);
    }

    /// @notice Allows to fetch a list of all minters.
    function get_minters() public view returns (address[] memory) {
        return minters;
    }
}