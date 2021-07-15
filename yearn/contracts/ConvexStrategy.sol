// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@keep-network/yearn-vaults/contracts/BaseStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";

/// @notice Interface for the Convex booster.
/// @dev This is an interface with just a few function signatures of the booster.
///      For more info and function description please see:
///      https://github.com/convex-eth/platform/blob/main/contracts/contracts/Booster.sol
interface IConvexBooster {
    function poolInfo(uint256)
        external
        view
        returns (
            address,
            address,
            address,
            address,
            address,
            bool
        );

    function deposit(
        uint256 poolId,
        uint256 amount,
        bool stake
    ) external returns (bool);
}

/// @notice Interface for the Convex reward pool.
/// @dev This is an interface with just a few function signatures of the reward pool.
///      For more info and function description please see:
///      https://github.com/convex-eth/platform/blob/main/contracts/contracts/BaseRewardPool.sol
interface IConvexRewardPool {
    function balanceOf(address account) external view returns (uint256);

    function withdrawAndUnwrap(uint256 amount, bool claim)
        external
        returns (bool);

    function withdrawAllAndUnwrap(bool claim) external;
}

/// @notice Interface for the optional metadata functions from the ERC20 standard.
interface IERC20Metadata {
    function symbol() external view returns (string memory);
}

/// @title ConvexStrategy
/// @notice TODO: Detailed strategy description.
/// @dev Implementation is based on:
///      - General Yearn strategy template
///        https://github.com/yearn/brownie-strategy-mix
///      - Convex implementation for tBTC v1 vault
///        https://github.com/orbxball/btc-curve-convex
contract ConvexStrategy is BaseStrategy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    uint256 public constant DENOMINATOR = 10000;

    // Address of the CurveYCRVVoter contract.
    address public constant voter =
        address(0xF147b8125d2ef93FB6965Db97D6746952a133934);
    // Address of the Convex Booster contract.
    address public constant booster =
        address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    // Address of the CRV token contract.
    address public constant crv =
        address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    // Address of the Convex CVX token contract.
    address public constant cvx =
        address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    // Address of the WETH token contract.
    address public constant weth =
        address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    // Address of the WBTC token contract.
    address public constant wbtc =
        address(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);
    // Address of the Uniswap V2 router contract.
    address public constant uniswap =
        address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    // Address of the depositor contract for the tBTC v2 Curve pool.
    address public tbtcCurvePoolDepositor;
    // ID of the Convex reward pool paired with the tBTC v2 Curve pool.
    uint256 public tbtcConvexRewardPoolId;
    // Address of the Convex reward pool contract paired with the
    // tBTC v2 Curve pool.
    address public tbtcConvexRewardPool;
    // Address of the DEX used to swap reward tokens back to the vault's
    // underlying token. This can be Uniswap or other Uni-like DEX.
    address public dex;
    // Determines the portion of CRV tokens which should be locked in the
    // Curve vote escrow to gain a CRV boost. This is the counter of a fraction
    // denominated by the DENOMINATOR constant. For example, if the value
    // is `1000`, that means 10% of tokens will be locked because
    // 1000/10000 = 0.1
    uint256 public keepCRV;

    constructor(
        address _vault,
        address _tbtcCurvePoolDepositor,
        address _tbtcConvexRewardPoolId
    ) public BaseStrategy(_vault) {
        // Strategy settings.
        minReportDelay = 12 hours;
        maxReportDelay = 3 days;
        profitFactor = 1000;
        debtThreshold = 1e21;
        dex = uniswap;
        keepCRV = 1000;

        // tBTC-related settings.
        tbtcCurvePoolDepositor = _tbtcCurvePoolDepositor;
        tbtcConvexRewardPoolId = _tbtcConvexRewardPoolId;
        (address lpToken, , , address rewardPool, , ) = IConvexBooster(booster)
        .poolInfo(_tbtcConvexRewardPoolId);
        require(lpToken == address(want), "Incorrect reward pool LP token");
        tbtcConvexRewardPool = rewardPool;
    }

    /// @notice Sets the portion of CRV tokens which should be locked in
    ///         the Curve vote escrow to gain CRV boost.
    /// @dev Can be called only by the strategist and governance.
    /// @param _keepCRV Portion as counter of a fraction denominated by the
    ///        DENOMINATOR constant.
    function setKeepCRV(uint256 _keepCRV) external onlyAuthorized {
        keepCRV = _keepCRV;
    }

    /// @return Name of the Yearn vault strategy.
    function name() external view override returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "Convex",
                    IERC20Metadata(address(want)).symbol()
                )
            );
    }

    /// @return Balance of the vault's underlying token under management.
    function balanceOfWant() public view returns (uint256) {
        return want.balanceOf(address(this));
    }

    /// @return Balance of the vault's underlying token staked into the Convex
    ///         reward pool.
    function balanceOfPool() public view returns (uint256) {
        return IConvexRewardPool(tbtcConvexRewardPool).balanceOf(address(this));
    }

    /// @return Sum of balanceOfWant and balanceOfPool.
    function estimatedTotalAssets() public view override returns (uint256) {
        return balanceOfWant().add(balanceOfPool());
    }

    /// @notice This method is defined in the BaseStrategy contract and is
    ///         meant to perform any adjustments to the core position(s) of this
    ///         strategy, given what change the vault made in the investable
    ///         capital available to the strategy. All free capital in the
    ///         strategy after the report was made is available for reinvestment.
    ///         This strategy implements the aforementioned behavior by taking
    ///         its balance of the vault's underlying token and depositing it to
    ///         the Convex Booster contract.
    /// @param debtOutstanding Will be 0 if the strategy is not past the
    ///        configured debt limit, otherwise its value will be how far past
    ///        the debt limit the strategy is. The strategy's debt limit is
    ///        configured in the vault.
    function adjustPosition(uint256 _debtOutstanding) internal override {
        uint256 wantBalance = want.balanceOf(address(this));
        if (wantBalance > 0) {
            want.safeApprove(booster, 0);
            want.safeApprove(booster, wantBalance);

            IConvexBooster(booster).deposit(id, wantBalance, true);
        }
    }

    /// @notice Withdraws a portion of the vault's underlying token from
    ///         the Convex reward pool.
    /// @param amount Amount to withdraw.
    /// @return Amount withdrawn.
    function withdrawSome(uint256 amount) internal returns (uint256) {
        amount = Math.min(amount, balanceOfPool());
        uint256 initialWantBalance = balanceOfWant();
        // Withdraw some vault's underlying tokens but do not claim the rewards
        // accumulated so far.
        IConvexRewardPool(tbtcConvexRewardPool).withdrawAndUnwrap(
            amount,
            false
        );
        return balanceOfWant().sub(initialWantBalance);
    }

    /// @notice This method is defined in the BaseStrategy contract and is meant
    ///         to liquidate up to amountNeeded of want token of this strategy's
    ///         positions, irregardless of slippage. Any excess will be
    ///         re-invested with adjustPosition. This function should return
    ///         the amount of want tokens made available by the liquidation.
    ///         If there is a difference between them, loss indicates whether
    ///         the difference is due to a realized loss, or if there is some
    ///         other situation at play (e.g. locked funds). This function is
    ///         used during emergency exit instead of prepareReturn to
    ///         liquidate all of the strategy's positions back to the vault.
    ///         This strategy implements the aforementioned behavior by
    ///         withdrawing a portion of the vault's underlying token
    ///         (want token) from the Convex reward pool.
    /// @dev The invariant `liquidatedAmount + loss <= amountNeeded` should
    ///      always be maintained.
    /// @param amountNeeded Amount of the vault's underlying tokens needed by
    ///        the liquidation process.
    /// @return liquidatedAmount Amount of vault's underlying tokens made
    ///         available by the liquidation.
    /// @return loss Amount of the loss.
    function liquidatePosition(uint256 amountNeeded)
        internal
        override
        returns (uint256 liquidatedAmount, uint256 loss)
    {
        uint256 wantBalance = want.balanceOf(address(this));
        if (wantBalance < amountNeeded) {
            liquidatedAmount = withdrawSome(amountNeeded.sub(wantBalance));
            liquidatedAmount = liquidatedAmount.add(wantBalance);
            loss = amountNeeded.sub(liquidatedAmount);
        } else {
            liquidatedAmount = amountNeeded;
        }
    }

    /// @notice This method is defined in the BaseStrategy contract and is meant
    ///         to liquidate everything and return the amount that got freed.
    ///         This strategy implements the aforementioned behavior by withdrawing
    ///         all vault's underlying tokens from the Convex reward pool.
    /// @dev This function is used during emergency exit instead of prepareReturn
    ///      to liquidate all of the strategy's positions back to the vault.
    /// @return amountFreed Amount that got freed.
    function liquidateAllPositions()
        internal
        override
        returns (uint256 amountFreed)
    {
        // Withdraw all vault's underlying tokens from the Convex reward pool.
        // However, do not claim the rewards accumulated so far because this is
        // an emergency action and we just focus on recovering all principle
        // funds, without trying to realize potential gains.
        IConvexRewardPool(tbtcConvexRewardPool).withdrawAllAndUnwrap(false);

        // Yearn docs doesn't specify clear enough what exactly should be
        // returned here. It may be either the total balance after
        // withdrawAllAndUnwrap or just the amount withdrawn. Currently opting
        // for the former because of
        // https://github.com/yearn/yearn-vaults/pull/311#discussion_r625588313.
        // Also, usage of this result in the harvest method in the BaseStrategy
        // seems to confirm that.
        return want.balanceOf(address(this));
    }

    /// @notice This method is defined in the BaseStrategy contract and is meant
    ///         to do anything necessary to prepare this strategy for migration,
    ///         such as transferring any reserve or LP tokens, CDPs, or other
    ///         tokens or stores of value. This strategy implements the
    ///         aforementioned behavior by withdrawing all vault's underlying
    ///         tokens from the Convex reward pool, claiming all rewards
    ///         accumulated so far, and transferring those rewards to the new
    ///         strategy.
    /// @param newStrategy Address of the new strategy meant to replace the
    ///        current one.
    function prepareMigration(address newStrategy) internal override {
        // Just withdraw the vault's underlying token from the Convex reward pool.
        // There is no need to transfer those tokens to the new strategy
        // right here as this is done in the BaseStrategy's migrate() method.
        // This call also claims the rewards accumulated so far but they
        // must be transferred to the new strategy manually.
        IConvexRewardPool(tbtcConvexRewardPool).withdrawAllAndUnwrap(true);

        // Transfer all claimed rewards to the new strategy manually.
        IERC20(crv).safeTransfer(
            newStrategy,
            IERC20(crv).balanceOf(address(this))
        );
        IERC20(cvx).safeTransfer(
            newStrategy,
            IERC20(cvx).balanceOf(address(this))
        );
        // TODO: Transfer gauge additional rewards too (KEEP token).
    }

    /// @notice Takes the keepCRV portion of the CRV balance and transfers
    ///         it to the CurveYCRVVoter contract in order to gain CRV boost.
    /// @param crvBalance Balance of CRV tokens under management.
    /// @return Amount of CRV tokens remaining under management after the
    ///         transfer.
    function adjustCRV(uint256 crvBalance) internal returns (uint256) {
        uint256 crvTransfer = crvBalance.mul(keepCRV).div(DENOMINATOR);
        IERC20(crv).safeTransfer(voter, crvTransfer);
        return crvBalance.sub(crvTransfer);
    }

    // TODO: Documentation.
    function prepareReturn(uint256 debtOutstanding)
        internal
        override
        returns (
            uint256 profit,
            uint256 loss,
            uint256 debtPayment
        )
    {
        // TODO: Implementation.
    }

    /// @notice This method is defined in the BaseStrategy contract and is meant
    ///         to define all tokens/tokenized positions this contract manages
    ///         on a persistent basis (e.g. not just for swapping back to
    ///         the want token ephemerally).
    /// @dev Should not include want token, already included in the base contract.
    /// @return Addresses of protected tokens
    function protectedTokens()
        internal
        view
        override
        returns (address[] memory)
    {
        address[] memory protected = new address[](2);
        protected[0] = crv;
        protected[1] = cvx;
        // TODO: Gauge additional rewards token (KEEP token).
        return protected;
    }

    /// @notice This method is defined in the BaseStrategy contract and is meant
    ///         to provide an accurate conversion from amtInWei (denominated in wei)
    ///         to want token (using the native decimal characteristics of want token).
    /// @param amtInWei The amount (in wei/1e-18 ETH) to convert to want tokens.
    /// @return The amount in want tokens.
    function ethToWant(uint256 amtInWei)
        public
        view
        virtual
        override
        returns (uint256)
    {
        // TODO: Create an accurate price oracle.
        return amtInWei;
    }
}
