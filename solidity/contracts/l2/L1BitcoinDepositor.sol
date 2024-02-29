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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../integrator/AbstractTBTCDepositor.sol";
import "../integrator/IBridge.sol";
import "../integrator/ITBTCVault.sol";
import "./Wormhole.sol";

// TODO: Document this contract.
contract L1BitcoinDepositor is
    AbstractTBTCDepositor,
    IWormholeReceiver,
    OwnableUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Reflects the deposit state:
    ///         - Unknown deposit has not been initialized yet.
    ///         - Initialized deposit has been initialized with a call to
    ///           `initializeDeposit` function and is known to this contract.
    ///         - Finalized deposit led to tBTC ERC20 minting and was finalized
    ///           with a call to `finalizeDeposit` function that deposited tBTC
    ///           to the Portal contract.
    enum DepositState {
        Unknown,
        Initialized,
        Finalized
    }

    /// @notice Holds the deposit state, keyed by the deposit key calculated for
    ///         the individual deposit during the call to `initializeDeposit`
    ///         function.
    mapping(uint256 => DepositState) public deposits;

    // TODO: Document other state variables.
    IERC20 public tbtcToken;
    IWormhole public wormhole;
    IWormholeRelayer public wormholeRelayer;
    IWormholeTokenBridge public wormholeTokenBridge;
    address public l2WormholeGateway;
    uint16 public l2ChainId;
    address public l2BitcoinDepositor;
    uint256 public l2FinalizeDepositGasLimit;

    event DepositInitialized(
        uint256 indexed depositKey,
        address indexed l2DepositOwner,
        address indexed l1Sender
    );

    event DepositFinalized(
        uint256 indexed depositKey,
        address indexed l2DepositOwner,
        address indexed l1Sender,
        uint256 initialAmount,
        uint256 tbtcAmount
    );

    event L2FinalizeDepositGasLimitUpdated(uint256 l2FinalizeDepositGasLimit);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _tbtcBridge,
        address _tbtcVault,
        address _wormhole,
        address _wormholeRelayer,
        address _wormholeTokenBridge,
        address _l2WormholeGateway,
        uint16 _l2ChainId,
        address _l2BitcoinDepositor
    ) external initializer {
        __AbstractTBTCDepositor_initialize(_tbtcBridge, _tbtcVault);
        __Ownable_init();

        tbtcToken = IERC20(ITBTCVault(_tbtcVault).tbtcToken());
        wormhole = IWormhole(_wormhole);
        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        wormholeTokenBridge = IWormholeTokenBridge(_wormholeTokenBridge);
        l2WormholeGateway = _l2WormholeGateway;
        l2ChainId = _l2ChainId;
        l2BitcoinDepositor = _l2BitcoinDepositor;
        l2FinalizeDepositGasLimit = 200_000;
    }

    // TODO: Document this function.
    function updateL2FinalizeDepositGasLimit(uint256 _l2FinalizeDepositGasLimit)
        external
        onlyOwner
    {
        l2FinalizeDepositGasLimit = _l2FinalizeDepositGasLimit;
        emit L2FinalizeDepositGasLimitUpdated(_l2FinalizeDepositGasLimit);
    }

    // TODO: Document this function.
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32
    ) external payable {
        require(
            msg.sender == address(wormholeRelayer),
            "Caller is not Wormhole Relayer"
        );

        require(
            sourceChain == l2ChainId,
            "Source chain is not the expected L2 chain"
        );

        require(
            WormholeUtils.fromWormholeAddress(sourceAddress) ==
                l2BitcoinDepositor,
            "Source address is not the expected L2 Bitcoin depositor"
        );

        (
            IBridgeTypes.BitcoinTxInfo memory fundingTx,
            IBridgeTypes.DepositRevealInfo memory reveal,
            address l2DepositOwner
        ) = abi.decode(
                payload,
                (
                    IBridgeTypes.BitcoinTxInfo,
                    IBridgeTypes.DepositRevealInfo,
                    address
                )
            );

        initializeDeposit(fundingTx, reveal, l2DepositOwner);
    }

    // TODO: Document this function.
    function initializeDeposit(
        IBridgeTypes.BitcoinTxInfo memory fundingTx,
        IBridgeTypes.DepositRevealInfo memory reveal,
        address l2DepositOwner
    ) public {
        require(
            l2DepositOwner != address(0),
            "L2 deposit owner must not be 0x0"
        );

        // Convert the L2 deposit owner address into the Wormhole format and
        // encode it as deposit extra data.
        bytes32 extraData = WormholeUtils.toWormholeAddress(l2DepositOwner);

        // TODO: Document how the Bridge works and why we don't need to validate input parameters.
        (uint256 depositKey, ) = _initializeDeposit(
            fundingTx,
            reveal,
            extraData
        );

        require(
            deposits[depositKey] == DepositState.Unknown,
            "Wrong deposit state"
        );

        deposits[depositKey] = DepositState.Initialized;

        emit DepositInitialized(depositKey, l2DepositOwner, msg.sender);
    }

    // TODO: Document this function.
    function finalizeDeposit(uint256 depositKey) external payable {
        require(
            deposits[depositKey] == DepositState.Initialized,
            "Wrong deposit state"
        );

        deposits[depositKey] = DepositState.Finalized;

        (
            uint256 initialDepositAmount,
            uint256 tbtcAmount,
            // Deposit extra data is actually the L2 deposit owner
            // address in Wormhole format.
            bytes32 l2DepositOwner
        ) = _finalizeDeposit(depositKey);

        emit DepositFinalized(
            depositKey,
            WormholeUtils.fromWormholeAddress(l2DepositOwner),
            msg.sender,
            initialDepositAmount,
            tbtcAmount
        );

        transferTbtc(tbtcAmount, l2DepositOwner);
    }

    // TODO: Document this function.
    function quoteFinalizeDeposit() public view returns (uint256 cost) {
        cost = _quoteFinalizeDeposit(wormhole.messageFee());
    }

    // TODO: Document this function.
    function _quoteFinalizeDeposit(uint256 messageFee)
        internal
        view
        returns (uint256 cost)
    {
        // Cost of delivering token and payload to `l2ChainId`.
        (uint256 deliveryCost, ) = wormholeRelayer.quoteEVMDeliveryPrice(
            l2ChainId,
            0,
            l2FinalizeDepositGasLimit
        );

        // Total cost = delivery cost + cost of publishing the `sending token`
        // Wormhole message.
        cost = deliveryCost + messageFee;
    }

    // TODO: Document this function.
    function transferTbtc(uint256 amount, bytes32 l2Receiver) internal {
        // Wormhole supports the 1e8 precision at most. TBTC is 1e18 so
        // the amount needs to be normalized.
        amount = WormholeUtils.normalize(amount);

        require(amount > 0, "Amount too low to bridge");

        // Cost of requesting a `finalize` message to be sent to
        //  `l2ChainId` with a gasLimit of `l2FinalizeDepositGasLimit`.
        uint256 wormholeMessageFee = wormhole.messageFee();
        uint256 cost = _quoteFinalizeDeposit(wormholeMessageFee);

        require(msg.value == cost, "Payment for Wormhole Relayer is too low");

        // The Wormhole Token Bridge will pull the TBTC amount
        // from this contract. We need to approve the transfer first.
        tbtcToken.safeIncreaseAllowance(address(wormholeTokenBridge), amount);

        // Initiate a Wormhole token transfer that will lock L1 TBTC within
        // the Wormhole Token Bridge contract and transfer Wormhole-wrapped
        // L2 TBTC to the corresponding `L2WormholeGateway` contract.
        uint64 transferSequence = wormholeTokenBridge.transferTokensWithPayload{
            value: wormholeMessageFee
        }(
            address(tbtcToken),
            amount,
            l2ChainId,
            WormholeUtils.toWormholeAddress(l2WormholeGateway),
            0, // Nonce is a free field that is not relevant in this context.
            abi.encode(l2Receiver) // Set the L2 receiver address as the transfer payload.
        );

        // Get Wormhole chain ID for this L1 chain.
        uint16 l1ChainId = wormhole.chainId();

        // Construct VAA representing the above Wormhole token transfer.
        WormholeTypes.VaaKey[]
            memory additionalVaas = new WormholeTypes.VaaKey[](1);
        additionalVaas[0] = WormholeTypes.VaaKey({
            chainId: l1ChainId,
            emitterAddress: WormholeUtils.toWormholeAddress(
                address(wormholeTokenBridge)
            ),
            sequence: transferSequence
        });

        // The Wormhole token transfer initiated above must be finalized on
        // the L2 chain. We achieve that by sending the transfer VAA to the
        // `L2BitcoinDepositor` contract. Once, the `L2BitcoinDepositor`
        // contract receives it, it calls the `L2WormholeGateway` contract
        // that redeems Wormhole-wrapped L2 TBTC from the Wormhole Token
        // Bridge and use it to mint canonical L2 TBTC to the receiver address.
        wormholeRelayer.sendVaasToEvm{value: cost - wormholeMessageFee}(
            l2ChainId,
            l2BitcoinDepositor,
            bytes(""), // No payload needed. The L2 receiver address is already encoded in the Wormhole token transfer payload.
            0, // No receiver value needed.
            l2FinalizeDepositGasLimit,
            additionalVaas,
            l1ChainId, // Set this L1 chain as the refund chain.
            msg.sender // Set the caller as the refund receiver.
        );
    }
}
