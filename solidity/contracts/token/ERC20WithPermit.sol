// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./IERC20WithPermit.sol";
import "./IReceiveApproval.sol";

/// @title  ERC20WithPermit
/// @notice Burnable ERC20 token with EIP2612 permit functionality. User can
///         authorize a transfer of their token with a signature conforming
///         EIP712 standard instead of an on-chain transaction from their
///         address. Anyone can submit this signature on the user's behalf by
///         calling the permit function, as specified in EIP2612 standard,
///         paying gas fees, and possibly performing other actions in the same
///         transaction.
/// @dev    By the time of implementing this contract there is no other audited
///         EIP2612 token implementation other than Uniswap V2 on which this
///         code is based on.
contract ERC20WithPermit is IERC20WithPermit, Ownable {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    mapping(address => uint256) public override nonces;

    uint256 public immutable cachedChainId;
    bytes32 public immutable cachedDomainSeparator;

    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant override PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

    uint256 public override totalSupply;

    string public name;
    string public symbol;

    uint8 public constant decimals = 18;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;

        cachedChainId = chainId();
        cachedDomainSeparator = buildDomainSeparator();
    }

    function transfer(address recipient, uint256 amount)
        external
        override
        returns (bool)
    {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        uint256 currentAllowance = allowance[sender][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(
                currentAllowance >= amount,
                "Transfer amount exceeds allowance"
            );
            _approve(sender, msg.sender, currentAllowance - amount);
        }
        _transfer(sender, recipient, amount);
        return true;
    }

    function permit(
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        /* solhint-disable-next-line not-rely-on-time */
        require(deadline >= block.timestamp, "Permission expired");

        // Validate `s` and `v` values for a malleability concern described in EIP2.
        // Only signatures with `s` value in the lower half of the secp256k1
        // curve's order and `v` value of 27 or 28 are considered valid.
        require(
            uint256(s) <=
                0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "Invalid signature 's' value"
        );
        require(v == 27 || v == 28, "Invalid signature 'v' value");

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            spender,
                            amount,
                            nonces[owner]++,
                            deadline
                        )
                    )
                )
            );
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(
            recoveredAddress != address(0) && recoveredAddress == owner,
            "Invalid signature"
        );
        _approve(owner, spender, amount);
    }

    function mint(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Mint to the zero address");
        totalSupply += amount;
        balanceOf[recipient] += amount;
        emit Transfer(address(0), recipient, amount);
    }

    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external override {
        uint256 currentAllowance = allowance[account][msg.sender];
        require(currentAllowance >= amount, "Burn amount exceeds allowance");
        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
    }

    function approveAndCall(
        address spender,
        uint256 value,
        bytes memory extraData
    ) external override returns (bool) {
        if (approve(spender, value)) {
            IReceiveApproval(spender).receiveApproval(
                msg.sender,
                value,
                address(this),
                extraData
            );
            return true;
        }
        return false;
    }

    function approve(address spender, uint256 amount)
        public
        override
        returns (bool)
    {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /* solhint-disable-next-line func-name-mixedcase */
    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        if (chainId() == cachedChainId) {
            return cachedDomainSeparator;
        } else {
            return buildDomainSeparator();
        }
    }

    function _burn(address account, uint256 amount) internal {
        uint256 currentBalance = balanceOf[account];
        require(currentBalance >= amount, "Burn amount exceeds balance");
        balanceOf[account] = currentBalance - amount;
        totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) private {
        require(sender != address(0), "Transfer from the zero address");
        require(recipient != address(0), "Transfer to the zero address");
        uint256 senderBalance = balanceOf[sender];
        require(senderBalance >= amount, "Transfer amount exceeds balance");
        balanceOf[sender] = senderBalance - amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) private {
        require(owner != address(0), "Approve from the zero address");
        require(spender != address(0), "Approve to the zero address");
        allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function buildDomainSeparator() private view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes(name)),
                    keccak256(bytes("1")),
                    chainId(),
                    address(this)
                )
            );
    }

    function chainId() private view returns (uint256 id) {
        /* solhint-disable-next-line no-inline-assembly */
        assembly {
            id := chainid()
        }
    }
}
