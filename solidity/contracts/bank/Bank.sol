// SPDX-License-Identifier: MIT

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
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Bitcoin Bank
/// @notice Bank is a central component tracking Bitcoin balances. Balances can
///         be transferred between holders and holders can approve their
///         balances to be spent by others. Balances in the Bank are updated for
///         depositors who deposit their Bitcoin into the Bridge and only the
///         Bridge can increase balances.
/// @dev Bank is a governable contract and the Governance can upgrade the Bridge
///      address.
contract Bank is Ownable {
    address public bridge;

    /// @notice The balance of a given account in the Bank. Zero by default.
    mapping(address => uint256) public balanceOf;

    /// @notice The remaining amount of balance a spender will be
    ///         allowed to transfer on behalf of an owner using
    ///         `transferBalanceFrom`. Zero by default.
    mapping(address => mapping(address => uint256)) public allowance;

    /// @notice Returns the current nonce for EIP2612 permission for the
    ///         provided balance owner for a replay protection. Used to
    ///         construct EIP2612 signature provided to `permit` function.
    mapping(address => uint256) public nonce;

    uint256 public immutable cachedChainId;
    bytes32 public immutable cachedDomainSeparator;

    /// @notice Returns EIP2612 Permit message hash. Used to construct EIP2612
    ///         signature provided to `permit` function.
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

    event BalanceTransferred(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    event BalanceApproved(
        address indexed owner,
        address indexed spender,
        uint256 amount
    );

    event BalanceIncreased(address indexed owner, uint256 amount);

    event BalanceDecreased(address indexed owner, uint256 amount);

    event BridgeUpdated(address newBridge);

    modifier onlyBridge() {
        require(msg.sender == address(bridge), "Caller is not the bridge");
        _;
    }

    constructor() {
        cachedChainId = block.chainid;
        cachedDomainSeparator = buildDomainSeparator();
    }

    /// @notice Allows the Governance to upgrade the Bridge address.
    /// @dev The function does not implement any governance delay and does not
    ///      check the status of the Bridge. The Governance implementation needs
    ///      to ensure all requirements for the upgrade are satisfied before
    ///      executing this function.
    function updateBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Bridge address must not be 0x0");
        bridge = _bridge;
        emit BridgeUpdated(_bridge);
    }

    /// @notice Moves the given `amount` of balance from the caller to
    ///         `recipient`.
    /// @dev Requirements:
    ///       - `recipient` cannot be the zero address,
    ///       - the caller must have a balance of at least `amount`.
    function transferBalance(address recipient, uint256 amount) external {
        _transferBalance(msg.sender, recipient, amount);
    }

    /// @notice Sets `amount` as the allowance of `spender` over the caller's
    ///         balance.
    /// @dev If the `amount` is set to `type(uint256).max` then
    ///      `transferBalanceFrom` will not reduce an allowance.
    ///      Beware that changing an allowance with this function brings the
    ///      risk that someone may use both the old and the new allowance by
    ///      unfortunate transaction ordering. Please use
    ///      `increaseBalanceAllowance` and `decreaseBalanceAllowance` to
    ///      eliminate the risk.
    function approveBalance(address spender, uint256 amount) external {
        _approveBalance(msg.sender, spender, amount);
    }

    /// @notice Atomically increases the balance allowance granted to `spender`
    ///         by the caller by the given `addedValue`.
    function increaseBalanceAllowance(address spender, uint256 addedValue)
        external
    {
        _approveBalance(
            msg.sender,
            spender,
            allowance[msg.sender][spender] + addedValue
        );
    }

    /// @notice Atomically decreases the balance allowance granted to `spender`
    ///         by the caller by the given `subtractedValue`.
    function decreaseBalanceAllowance(address spender, uint256 subtractedValue)
        external
    {
        uint256 currentAllowance = allowance[msg.sender][spender];
        require(
            currentAllowance >= subtractedValue,
            "Can not decrease balance allowance below zero"
        );
        unchecked {
            _approveBalance(
                msg.sender,
                spender,
                currentAllowance - subtractedValue
            );
        }
    }

    /// @notice Moves `amount` of balance from `spender` to `recipient` using the
    ///         allowance mechanism. `amount` is then deducted from the caller's
    ///         allowance unless the allowance was made for `type(uint256).max`.
    /// @dev Requirements:
    ///      - `recipient` cannot be the zero address,
    ///      - `spender` must have a balance of at least `amount`,
    ///      - the caller must have allowance for `spender`'s balance of at
    ///        least `amount`.
    function transferBalanceFrom(
        address spender,
        address recipient,
        uint256 amount
    ) external {
        uint256 currentAllowance = allowance[spender][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(
                currentAllowance >= amount,
                "Transfer amount exceeds allowance"
            );
            unchecked {
                _approveBalance(spender, msg.sender, currentAllowance - amount);
            }
        }
        _transferBalance(spender, recipient, amount);
    }

    /// @notice EIP2612 approval made with secp256k1 signature.
    ///         Users can authorize a transfer of their balance with a signature
    ///         conforming EIP712 standard, rather than an on-chain transaction
    ///         from their address. Anyone can submit this signature on the
    ///         user's behalf by calling the permit function, paying gas fees,
    ///         and possibly performing other actions in the same transaction.
    /// @dev The deadline argument can be set to `type(uint256).max to create
    ///      permits that effectively never expire.  If the `amount` is set
    ///      to `type(uint256).max` then `transferBalanceFrom` will not
    ///      reduce an allowance. Beware that changing an allowance with this
    ///      function brings the risk that someone may use both the old and the
    ///      new allowance by unfortunate transaction ordering. Please use
    ///      `increaseBalanceAllowance` and `decreaseBalanceAllowance` to
    ///      eliminate the risk.
    function permit(
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
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
                            nonce[owner]++,
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
        _approveBalance(owner, spender, amount);
    }

    /// @notice Increases balances of the provided `recipients` by the provided
    ///         `amounts`. Can only be called by the Bridge.
    /// @dev This function fails if the lengths of the arrays are not the same.
    function increaseBalances(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyBridge {
        require(
            recipients.length == amounts.length,
            "Arrays must have the same length"
        );
        for (uint256 i = 0; i < recipients.length; i++) {
            _increaseBalance(recipients[i], amounts[i]);
        }
    }

    /// @notice Increases balance of the provided `recipient` by the provided
    ///         `amount`. Can only be called by the Bridge.
    function increaseBalance(address recipient, uint256 amount)
        external
        onlyBridge
    {
        _increaseBalance(recipient, amount);
    }

    /// @notice Decreases caller's balance by the provided `amount`. There is no
    ///         way to restore the balance so do not call this function unless
    ///         you really know what you are doing!
    function decreaseBalance(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        emit BalanceDecreased(msg.sender, amount);
    }

    /// @notice Returns hash of EIP712 Domain struct with `TBTC Bank` as
    ///         a signing domain and Bank contract as a verifying contract.
    ///         Used to construct EIP2612 signature provided to `permit`
    ///         function.
    /* solhint-disable-next-line func-name-mixedcase */
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        // As explained in EIP-2612, if the DOMAIN_SEPARATOR contains the
        // chainId and is defined at contract deployment instead of
        // reconstructed for every signature, there is a risk of possible replay
        // attacks between chains in the event of a future chain split.
        // To address this issue, we check the cached chain ID against the
        // current one and in case they are different, we build domain separator
        // from scratch.
        if (block.chainid == cachedChainId) {
            return cachedDomainSeparator;
        } else {
            return buildDomainSeparator();
        }
    }

    function _increaseBalance(address recipient, uint256 amount) internal {
        require(
            recipient != address(this),
            "Can not increase balance for Bank"
        );
        balanceOf[recipient] += amount;
        emit BalanceIncreased(recipient, amount);
    }

    function _transferBalance(
        address spender,
        address recipient,
        uint256 amount
    ) private {
        require(
            recipient != address(0),
            "Can not transfer to the zero address"
        );
        require(
            recipient != address(this),
            "Can not transfer to the Bank address"
        );

        uint256 spenderBalance = balanceOf[spender];
        require(spenderBalance >= amount, "Transfer amount exceeds balance");
        unchecked {balanceOf[spender] = spenderBalance - amount;}
        balanceOf[recipient] += amount;
        emit BalanceTransferred(spender, recipient, amount);
    }

    function _approveBalance(
        address owner,
        address spender,
        uint256 amount
    ) private {
        require(spender != address(0), "Can not approve to the zero address");
        allowance[owner][spender] = amount;
        emit BalanceApproved(owner, spender, amount);
    }

    function buildDomainSeparator() private view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes("TBTC Bank")),
                    keccak256(bytes("1")),
                    block.chainid,
                    address(this)
                )
            );
    }
}
