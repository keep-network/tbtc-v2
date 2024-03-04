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

import "@keep-network/random-beacon/contracts/Reimbursable.sol";
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
    OwnableUpgradeable,
    Reimbursable
{
    using SafeERC20 for IERC20;

    /// @notice Reflects the deposit state:
    ///         - Unknown deposit has not been initialized yet.
    ///         - Initialized deposit has been initialized with a call to
    ///           `initializeDeposit` function and is known to this contract.
    ///         - Finalized deposit led to TBTC ERC20 minting and was finalized
    ///           with a call to `finalizeDeposit` function that transferred
    ///           TBTC ERC20 to the L2 deposit owner.
    enum DepositState {
        Unknown,
        Initialized,
        Finalized
    }

    /// @notice Holds information about a deferred gas reimbursement.
    struct GasReimbursement {
        /// @notice Receiver that is supposed to receive the reimbursement.
        address receiver;
        /// @notice Gas expenditure that is meant to be reimbursed.
        uint256 gasSpent;
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
    /// @notice Holds deferred gas reimbursements for deposit initialization
    ///         (indexed by deposit key). Reimbursement for deposit
    ///         initialization is paid out upon deposit finalization. This is
    ///         because the tBTC Bridge accepts all (even invalid) deposits but
    ///         mints ERC20 TBTC only for the valid ones. Paying out the
    ///         reimbursement directly upon initialization would make the
    ///         reimbursement pool vulnerable to malicious actors that could
    ///         drain it by initializing invalid deposits.
    mapping(uint256 => GasReimbursement) public gasReimbursements;
    /// @notice Gas that is meant to balance the overall cost of deposit initialization.
    ///         Can be updated by the owner based on the current market conditions.
    uint256 public initializeDepositGasOffset;
    /// @notice Gas that is meant to balance the overall cost of deposit finalization.
    ///         Can be updated by the owner based on the current market conditions.
    uint256 public finalizeDepositGasOffset;

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

    event GasOffsetParametersUpdated(
        uint256 initializeDepositGasOffset,
        uint256 finalizeDepositGasOffset
    );

    /// @dev This modifier comes from the `Reimbursable` base contract and
    ///      must be overridden to protect the `updateReimbursementPool` call.
    modifier onlyReimbursableAdmin() override {
        require(msg.sender == owner(), "Caller is not the owner");
        _;
    }

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
        uint16 _l2ChainId
    ) external initializer {
        __AbstractTBTCDepositor_initialize(_tbtcBridge, _tbtcVault);
        __Ownable_init();

        tbtcToken = IERC20(ITBTCVault(_tbtcVault).tbtcToken());
        wormhole = IWormhole(_wormhole);
        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        wormholeTokenBridge = IWormholeTokenBridge(_wormholeTokenBridge);
        l2WormholeGateway = _l2WormholeGateway;
        l2ChainId = _l2ChainId;
        l2FinalizeDepositGasLimit = 500_000;
        initializeDepositGasOffset = 20_000;
        finalizeDepositGasOffset = 20_000;
    }

    // TODO: Document this function.
    function attachL2BitcoinDepositor(address _l2BitcoinDepositor)
        external
        onlyOwner
    {
        require(
            l2BitcoinDepositor == address(0),
            "L2 Bitcoin Depositor already set"
        );
        require(
            _l2BitcoinDepositor != address(0),
            "L2 Bitcoin Depositor must not be 0x0"
        );
        l2BitcoinDepositor = _l2BitcoinDepositor;
    }

    // TODO: Document this function.
    function updateL2FinalizeDepositGasLimit(uint256 _l2FinalizeDepositGasLimit)
        external
        onlyOwner
    {
        l2FinalizeDepositGasLimit = _l2FinalizeDepositGasLimit;
        emit L2FinalizeDepositGasLimitUpdated(_l2FinalizeDepositGasLimit);
    }

    /// @notice Updates the values of gas offset parameters.
    /// @dev Can be called only by the contract owner. The caller is responsible
    ///      for validating parameters.
    /// @param newInitializeDepositGasOffset New initialize deposit gas offset.
    /// @param newFinalizeDepositGasOffset New finalize deposit gas offset.
    function updateGasOffsetParameters(
        uint256 newInitializeDepositGasOffset,
        uint256 newFinalizeDepositGasOffset
    ) external onlyOwner {
        initializeDepositGasOffset = newInitializeDepositGasOffset;
        finalizeDepositGasOffset = newFinalizeDepositGasOffset;

        emit GasOffsetParametersUpdated(
            newInitializeDepositGasOffset,
            newFinalizeDepositGasOffset
        );
    }

    // TODO: Document this function.
    function initializeDeposit(
        IBridgeTypes.BitcoinTxInfo calldata fundingTx,
        IBridgeTypes.DepositRevealInfo calldata reveal,
        address l2DepositOwner
    ) external {
        uint256 gasStart = gasleft();

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

        if (address(reimbursementPool) != address(0)) {
            // Do not issue a reimbursement immediately. Record
            // a deferred reimbursement that will be paid out upon deposit
            // finalization. This is because the tBTC Bridge accepts all
            // (even invalid) deposits but mints ERC20 TBTC only for the valid
            // ones. Paying out the reimbursement directly upon initialization
            // would make the reimbursement pool vulnerable to malicious actors
            // that could drain it by initializing invalid deposits.
            gasReimbursements[depositKey] = GasReimbursement({
                receiver: msg.sender,
                gasSpent: (gasStart - gasleft()) + initializeDepositGasOffset
            });
        }
    }

    // TODO: Document this function.
    function finalizeDeposit(uint256 depositKey) public payable {
        uint256 gasStart = gasleft();

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

        _transferTbtc(tbtcAmount, l2DepositOwner);

        if (address(reimbursementPool) != address(0)) {
            // If there is a deferred reimbursement for this deposit
            // initialization, pay it out now.
            GasReimbursement memory reimbursement = gasReimbursements[
                depositKey
            ];
            if (reimbursement.receiver != address(0)) {
                delete gasReimbursements[depositKey];

                reimbursementPool.refund(
                    reimbursement.gasSpent,
                    reimbursement.receiver
                );
            }

            // Pay out the reimbursement for deposit finalization. As this
            // call is payable and this transaction carries out a msg.value
            // that covers Wormhole cost, we need to reimburse that as well.
            // However, the `ReimbursementPool` issues refunds based on
            // gas spent. We need to convert msg.value accordingly using
            // the `_refundToGasSpent` function.
            uint256 msgValueOffset = _refundToGasSpent(msg.value);
            reimbursementPool.refund(
                (gasStart - gasleft()) +
                    msgValueOffset +
                    finalizeDepositGasOffset,
                msg.sender
            );
        }
    }

    /// @notice The `ReimbursementPool` contract issues refunds based on
    ///         gas spent. If there is a need to get a specific refund based
    ///         on WEI value, such a value must be first converted to gas spent.
    ///         This function does such a conversion.
    /// @param refund Refund value in WEI.
    /// @return Refund value as gas spent.
    /// @dev This function is the reverse of the logic used
    ///      within `ReimbursementPool.refund`.
    function _refundToGasSpent(uint256 refund) internal returns (uint256) {
        uint256 maxGasPrice = reimbursementPool.maxGasPrice();
        uint256 staticGas = reimbursementPool.staticGas();

        uint256 gasPrice = tx.gasprice < maxGasPrice
            ? tx.gasprice
            : maxGasPrice;

        return (refund / gasPrice) - staticGas;
    }

    // TODO: Document this function.
    function quoteFinalizeDeposit() external view returns (uint256 cost) {
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
    function _transferTbtc(uint256 amount, bytes32 l2Receiver) internal {
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

        // Construct VAA representing the above Wormhole token transfer.
        WormholeTypes.VaaKey[]
            memory additionalVaas = new WormholeTypes.VaaKey[](1);
        additionalVaas[0] = WormholeTypes.VaaKey({
            chainId: wormhole.chainId(),
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
            l2ChainId, // Set the L2 chain as the refund chain to avoid cross-chain refunds.
            msg.sender // Set the caller as the refund receiver.
        );
    }
}
