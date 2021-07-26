// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@keep-network/yearn-vaults/contracts/BaseStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";

/// @notice Interface for the CurveFi pool.
/// @dev This is an interface with just a few function signatures of the pool.
///      For more info and function description please see:
///      https://github.com/curvefi/curve-contract/tree/master/contracts/pool-templates
interface ICurvePool {
    function add_liquidity(uint256[4] calldata amounts, uint256 min_mint_amount)
        external
        payable;

    function calc_token_amount(uint256[4] calldata amounts, bool deposit)
        external
        view
        returns (uint256);
}

/// @notice Interface for the proxy contract which allows strategies to
///         make calls to the Curve DAO through the common CurveYCRVVoter.
/// @dev This is an interface with just a few function signatures of the proxy.
///      For more info and function description please see:
///      - https://github.com/yearn/yearn-protocol/blob/develop/contracts/strategies/StrategyProxy.sol
///      - https://docs.yearn.finance/resources/guides/how-to-understand-crv-vote-locking
interface IStrategyProxy {
    function balanceOf(address gauge) external view returns (uint256);

    function deposit(address gauge, address token) external;

    function withdraw(
        address gauge,
        address token,
        uint256 amount
    ) external returns (uint256);

    function withdrawAll(address gauge, address token)
        external
        returns (uint256);

    function harvest(address gauge) external;

    function claimRewards(address gauge, address token) external;

    function approveStrategy(address gauge, address strategy) external;
}

/// @notice Interface for the Uniswap v2 router.
/// @dev This is an interface with just a few function signatures of the
///      router contract. For more info and function description please see:
///      https://uniswap.org/docs/v2/smart-contracts/router02
///      This interface allows to interact with Sushiswap as well.
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256,
        uint256,
        address[] calldata,
        address,
        uint256
    ) external;

    function getAmountsOut(uint256 amountIn, address[] memory path)
        external
        view
        returns (uint256[] memory amounts);
}

/// @notice Interface for the optional metadata functions from the ERC20 standard.
interface IERC20Metadata {
    function symbol() external view returns (string memory);
}

/// @title CurveVoterProxyStrategy
/// @notice This strategy is meant to be used with the Curve tBTC v2 pool vault.
///         The vault's underlying token (a.k.a. want token) should be the LP
///         token of the Curve tBTC v2 pool. This strategy borrows the vault's
///         underlying token up to the debt limit configured for this strategy
///         in the vault. In order to make the profit, the strategy deposits
///         the borrowed tokens into the gauge contract of the Curve tBTC v2 pool.
///         Depositing tokens in the gauge generates regular CRV rewards and
///         can provide additional rewards (denominated in another token)
///         if the gauge stakes its deposits into the Synthetix staking
///         rewards contract. The financial outcome is settled upon a call
///         of the `harvest` method (BaseStrategy.sol). Once that call is made,
///         the strategy harvests the CRV rewards from the pool's gauge. Then,
///         it takes a small portion (defined by keepCRV param) and locks it
///         into the Curve vote escrow (via CurveYCRVVoter contract) to gain CRV
///         boost and increase future gains. The rest of CRV tokens is used to
///         buy wBTC via a decentralized exchange. If the pool's gauge supports
///         additional rewards from Synthetix staking, the strategy claims
///         that reward too and uses obtained reward tokens to buy more wBTC.
///         At the end, the strategy takes acquired wBTC and deposits them
///         to the Curve tBTC v2 pool. This way it obtains new LP tokens
///         the vault is interested for, and makes the profit in result.
///         At this stage, the strategy may repay some debt back to the vault,
///         if needed. The entire cycle repeats for the strategy lifetime so
///         all gains are constantly reinvested. Worth to flag that current
///         implementation uses wBTC as the intermediary token because
///         of its liquidity and ubiquity in BTC-based Curve pools.
/// @dev Implementation is based on:
///      - General Yearn strategy template
///        https://github.com/yearn/brownie-strategy-mix
///      - Curve voter proxy strategy template
///        https://github.com/orbxball/curve-voter-proxy
///      - Curve voter proxy implementation for tBTC v1 vault
///        https://github.com/orbxball/btc-curve-voter-proxy
contract CurveVoterProxyStrategy is BaseStrategy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    uint256 public constant DENOMINATOR = 10000;

    // Address of the CurveYCRVVoter contract.
    address public constant voter =
        address(0xF147b8125d2ef93FB6965Db97D6746952a133934);
    // Address of the StrategyProxy contract.
    address public strategyProxy =
        address(0xA420A63BbEFfbda3B147d0585F1852C358e2C152);
    // Address of the CRV token contract.
    address public constant crvToken =
        address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    // Address of the WETH token contract.
    address public constant wethToken =
        address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    // Address of the WBTC token contract.
    address public constant wbtcToken =
        address(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);
    // Address of the Uniswap V2 router contract.
    address public constant uniswap =
        address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    // Address of the depositor contract for the tBTC v2 Curve pool.
    address public tbtcCurvePoolDepositor;
    // Address of the gauge contract for the tBTC v2 Curve pool.
    address public tbtcCurvePoolGauge;
    // Address of the additional reward token distributed by the gauge contract
    // of the tBTC v2 Curve pool. This is applicable only in case when the gauge
    // stakes LP tokens into the Synthetix staking rewards contract
    // (i.e. the gauge is an instance of LiquidityGaugeReward contract).
    // Can be unset if additional rewards are not supported by the gauge.
    address public tbtcCurvePoolGaugeReward;
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
        address _tbtcCurvePoolGauge,
        address _tbtcCurvePoolGaugeReward // optional, zero is valid value
    ) public BaseStrategy(_vault) {
        // Strategy settings.
        minReportDelay = 6 hours;
        maxReportDelay = 2 days;
        profitFactor = 1;
        debtThreshold = 1e24;
        dex = uniswap;
        keepCRV = 1000;

        // tBTC-related settings.
        tbtcCurvePoolDepositor = _tbtcCurvePoolDepositor;
        tbtcCurvePoolGauge = _tbtcCurvePoolGauge;
        tbtcCurvePoolGaugeReward = _tbtcCurvePoolGaugeReward;
    }

    /// @notice Sets the strategy proxy contract address.
    /// @dev Can be called only by the governance.
    /// @param _strategyProxy Address of the new proxy.
    function setStrategyProxy(address _strategyProxy) external onlyGovernance {
        strategyProxy = _strategyProxy;
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
                    "Curve",
                    IERC20Metadata(address(want)).symbol(),
                    "VoterProxy"
                )
            );
    }

    /// @return Balance of the vault's underlying token under management.
    function balanceOfWant() public view returns (uint256) {
        return want.balanceOf(address(this));
    }

    /// @return Balance of the vault's underlying token deposited into the Curve
    ///         pool's gauge.
    function balanceOfPool() public view returns (uint256) {
        return IStrategyProxy(strategyProxy).balanceOf(tbtcCurvePoolGauge);
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
    ///         the Curve pool's gauge via the strategy proxy contract.
    /// @param debtOutstanding Will be 0 if the strategy is not past the
    ///        configured debt limit, otherwise its value will be how far past
    ///        the debt limit the strategy is. The strategy's debt limit is
    ///        configured in the vault.
    function adjustPosition(uint256 debtOutstanding) internal override {
        uint256 wantBalance = want.balanceOf(address(this));
        if (wantBalance > 0) {
            want.safeTransfer(strategyProxy, wantBalance);
            IStrategyProxy(strategyProxy).deposit(
                tbtcCurvePoolGauge,
                address(want)
            );
        }
    }

    /// @notice Withdraws a portion of the vault's underlying token from
    ///         the Curve pool's gauge.
    /// @param amount Amount to withdraw.
    /// @return Amount withdrawn.
    function withdrawSome(uint256 amount) internal returns (uint256) {
        amount = Math.min(amount, balanceOfPool());
        return
            IStrategyProxy(strategyProxy).withdraw(
                tbtcCurvePoolGauge,
                address(want),
                amount
            );
    }

    /// @notice This method is defined in the BaseStrategy contract and is meant
    ///         to liquidate up to amountNeeded of want token of this strategy's
    ///         positions, irregardless of slippage. Any excess will be
    ///         re-invested with adjustPosition. This function should return
    ///         the amount of want tokens made available by the liquidation.
    ///         If there is a difference between them, loss indicates whether
    ///         the difference is due to a realized loss, or if there is some
    ///         other situation at play (e.g. locked funds). This strategy
    ///         implements the aforementioned behavior by withdrawing a portion
    ///         of the vault's underlying token (want token) from the Curve
    ///         pool's gauge.
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
    ///         all vault's underlying tokens from the Curve pool's gauge.
    /// @dev This function is used during emergency exit instead of prepareReturn
    ///      to liquidate all of the strategy's positions back to the vault.
    /// @return amountFreed Amount that got freed.
    function liquidateAllPositions()
        internal
        override
        returns (uint256 amountFreed)
    {
        IStrategyProxy(strategyProxy).withdrawAll(
            tbtcCurvePoolGauge,
            address(want)
        );

        // Yearn docs doesn't specify clear enough what exactly should be
        // returned here. It may be either the total balance after withdrawAll
        // or just the amount withdrawn. Currently opting for the former
        // because of https://github.com/yearn/yearn-vaults/pull/311#discussion_r625588313.
        // Also, usage of this result in the harvest method in the BaseStrategy
        // seems to confirm that.
        return want.balanceOf(address(this));
    }

    /// @notice This method is defined in the BaseStrategy contract and is meant
    ///         to do anything necessary to prepare this strategy for migration,
    ///         such as transferring any reserve or LP tokens, CDPs, or other
    ///         tokens or stores of value. This strategy implements the
    ///         aforementioned behavior by withdrawing all vault's underlying
    ///         tokens from the Curve pool's gauge.
    /// @param newStrategy Address of the new strategy meant to replace the
    ///        current one.
    function prepareMigration(address newStrategy) internal override {
        // Just withdraw the vault's underlying token from the Curve pool's gauge.
        // There is no need to transfer those tokens to the new strategy
        // right here as this is done in the BaseStrategy's migrate() method.
        IStrategyProxy(strategyProxy).withdrawAll(
            tbtcCurvePoolGauge,
            address(want)
        );
    }

    /// @notice Takes the keepCRV portion of the CRV balance and transfers
    ///         it to the CurveYCRVVoter contract in order to gain CRV boost.
    /// @param crvBalance Balance of CRV tokens under management.
    /// @return Amount of CRV tokens remaining under management after the
    ///         transfer.
    function adjustCRV(uint256 crvBalance) internal returns (uint256) {
        uint256 crvTransfer = crvBalance.mul(keepCRV).div(DENOMINATOR);
        IERC20(crvToken).safeTransfer(voter, crvTransfer);
        return crvBalance.sub(crvTransfer);
    }

    /// @notice This method is defined in the BaseStrategy contract and is meant
    ///         to perform any strategy unwinding or other calls necessary to
    ///         capture the free return this strategy has generated since the
    ///         last time its core position(s) were adjusted. Examples include
    ///         unwrapping extra rewards. This call is only used during normal
    ///         operation of a strategy, and should be optimized to minimize
    ///         losses as much as possible. This strategy implements the
    ///         aforementioned behavior by harvesting the Curve pool's gauge
    ///         CRV rewards, using most of the CRV tokens to buy one of the
    ///         Curve pool's accepted token, and depositing that token back to
    ///         the Curve pool. This way the strategy is gaining new vault's
    ///         underlying tokens thus making the profit. A small portion of
    ///         CRV rewards (defined by keepCRV param) is transferred to the
    ///         voter contract to increase CRV boost and get more CRV rewards
    ///         in the future. Apart from that, this strategy also sells
    ///         the Curve pool's gauge additional rewards, generated using the
    ///         Synthetix staking rewards contract.
    /// @param debtOutstanding Will be 0 if the strategy is not past the
    ///        configured debt limit, otherwise its value will be how far past
    ///        the debt limit the strategy is. The strategy's debt limit is
    ///        configured in the vault.
    /// @return profit Amount of realized profit.
    /// @return loss Amount of realized loss.
    /// @return debtPayment Amount of repaid debt. The value of debtPayment
    ///         should be less than or equal to debtOutstanding. It is okay for
    ///         it to be less than debtOutstanding, as that should only used as
    ///         a guide for how much is left to pay back. Payments should be
    ///         made to minimize loss from slippage, debt, withdrawal fees, etc.
    function prepareReturn(uint256 debtOutstanding)
        internal
        override
        returns (
            uint256 profit,
            uint256 loss,
            uint256 debtPayment
        )
    {
        // Get the initial balance of the vault's underlying token under
        // strategy management.
        uint256 initialWantBalance = want.balanceOf(address(this));

        // Harvest the CRV rewards from the Curve pool's gauge.
        IStrategyProxy(strategyProxy).harvest(tbtcCurvePoolGauge);

        // Buy WBTC using harvested CRV tokens.
        uint256 crvBalance = IERC20(crvToken).balanceOf(address(this));
        if (crvBalance > 0) {
            // Deposit a portion of CRV to the voter to gain CRV boost.
            crvBalance = adjustCRV(crvBalance);

            IERC20(crvToken).safeIncreaseAllowance(dex, crvBalance);

            address[] memory path = new address[](3);
            path[0] = crvToken;
            path[1] = wethToken;
            path[2] = wbtcToken;

            IUniswapV2Router(dex).swapExactTokensForTokens(
                crvBalance,
                0,
                path,
                address(this),
                now
            );
        }

        // Claim additional reward tokens from the gauge if applicable.
        if (tbtcCurvePoolGaugeReward != address(0)) {
            IStrategyProxy(strategyProxy).claimRewards(
                tbtcCurvePoolGauge,
                tbtcCurvePoolGaugeReward
            );

            uint256 rewardBalance = IERC20(tbtcCurvePoolGaugeReward).balanceOf(
                address(this)
            );
            if (rewardBalance > 0) {
                IERC20(tbtcCurvePoolGaugeReward).safeIncreaseAllowance(
                    dex,
                    rewardBalance
                );

                address[] memory path = new address[](3);
                path[0] = tbtcCurvePoolGaugeReward;
                path[1] = wethToken;
                path[2] = wbtcToken;

                IUniswapV2Router(dex).swapExactTokensForTokens(
                    rewardBalance,
                    0,
                    path,
                    address(this),
                    now
                );
            }
        }

        // Deposit acquired WBTC to the Curve pool to gain additional
        // vault's underlying tokens.
        uint256 wbtcBalance = IERC20(wbtcToken).balanceOf(address(this));
        if (wbtcBalance > 0) {
            IERC20(wbtcToken).safeIncreaseAllowance(
                tbtcCurvePoolDepositor,
                wbtcBalance
            );
            // TODO: When the new curve pool with tBTC v2 is deployed, verify that
            // the index of wBTC in the array is correct.
            ICurvePool(tbtcCurvePoolDepositor).add_liquidity(
                [0, 0, wbtcBalance, 0],
                0
            );
        }

        // Check the profit and loss in the context of strategy debt.
        uint256 totalAssets = estimatedTotalAssets();
        uint256 totalDebt = vault.strategies(address(this)).totalDebt;
        if (totalAssets < totalDebt) {
            loss = totalDebt - totalAssets;
            profit = 0;
        } else {
            profit = want.balanceOf(address(this)).sub(initialWantBalance);
        }

        // Repay some vault debt if needed.
        if (debtOutstanding > 0) {
            withdrawSome(debtOutstanding);
            debtPayment = Math.min(
                debtOutstanding,
                balanceOfWant().sub(profit)
            );
        }
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
        if (tbtcCurvePoolGaugeReward != address(0)) {
            address[] memory protected = new address[](2);
            protected[0] = crvToken;
            protected[1] = tbtcCurvePoolGaugeReward;
            return protected;
        }

        address[] memory protected = new address[](1);
        protected[0] = crvToken;
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
        address[] memory path = new address[](2);
        path[0] = wethToken;
        path[1] = wbtcToken;

        // As of writing this contract, there's no pool available that trades
        // an underlying token with ETH. To overcome this, the ETH amount
        // denominated in WEI should be converted into an amount denominated
        // in one of the tokens accepted by the tBTC v2 Curve pool using Uniswap.
        // The wBTC token was chosen arbitrarily since it is already used in this
        // contract for other operations on Uniswap.
        // amounts[0] -> ETH in wei
        // amounts[1] -> wBTC
        uint256[] memory amounts = IUniswapV2Router(dex).getAmountsOut(
            amtInWei,
            path
        );

        // Use the amount denominated in wBTC to calculate the amount of LP token
        // (vault's underlying token) that could be obtained if that wBTC amount
        // was deposited in the Curve pool that has tBTC v2 in it. This way we
        // obtain an estimated value of the original WEI amount represented in
        // the vault's underlying token.
        //
        // TODO: When the new curve pool with tBTC v2 is deployed, verify that
        // the index of wBTC (amounts[1]) in the array is correct.
        return
            ICurvePool(tbtcCurvePoolDepositor).calc_token_amount(
                [0, 0, amounts[1], 0],
                true
            );
    }
}
