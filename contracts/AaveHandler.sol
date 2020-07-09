pragma solidity 0.5.12;

import "./Handler.sol";
import "./library/ReentrancyGuard.sol";
import "./interface/IAave.sol";

contract AaveHandler is Handler, ReentrancyGuard {
    address public aaveLendingPool;
    address public aaveLendingPoolCore;

    // mapping(address => uint256) public interestDetails;
    struct InterestDetails {
        uint256 totalUnderlyingBalance; // Total underlying balance including interest
        uint256 interest; // Total interest
    }
    // Based on underlying token, get current interest details
    mapping(address => InterestDetails) public interestDetails;

    constructor(
        address _dTokenController,
        address _lendingPool,
        address _lendingPoolCore
    ) public {
        initialize(_dTokenController, _lendingPool, _lendingPoolCore);
    }

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize(
        address _dTokenController,
        address _lendingPool,
        address _lendingPoolCore
    ) public {
        super.initialize(_dTokenController);
        aaveLendingPool = _lendingPool;
        aaveLendingPoolCore = _lendingPoolCore;
    }

    function setLendingPoolCore(address _newLendingPoolCore) external auth {
        aaveLendingPoolCore = _newLendingPoolCore;
    }

    function setLendingPool(address _newLendingPool) external auth {
        aaveLendingPool = _newLendingPool;
    }

    /**
     * @dev Authorized function to approves market and dToken to transfer handler's underlying token.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken) public auth {
        if (
            IERC20(_underlyingToken).allowance(
                address(this),
                aaveLendingPoolCore
            ) != uint256(-1)
        ) {
            require(
                doApprove(_underlyingToken, aaveLendingPoolCore, uint256(-1)),
                "approve: Approve aToken failed!"
            );
        }

        super.approve(_underlyingToken);
    }

    /**
     * @dev Deposit token to market, only called by dToken contract.
     * @param _underlyingToken Token to deposit.
     * @return The actual deposited token amount.
     */
    function deposit(address _underlyingToken, uint256 _amount)
        external
        whenNotPaused
        auth
        nonReentrant
        returns (uint256)
    {
        require(
            tokenIsEnabled(_underlyingToken),
            "deposit: Token is disabled!"
        );
        require(
            _amount > 0,
            "deposit: Deposit amount should be greater than 0!"
        );

        address _aToken = getAToken(_underlyingToken);
        require(_aToken != address(0x0), "deposit: Do not support token!");

        uint256 _MarketBalanceBefore = IERC20(_aToken).balanceOf(address(this));

        // Mint all the token balance of the handler,
        // which should be the exact deposit amount normally,
        // but there could be some unexpected transfers before.
        uint256 _handlerBalance = IERC20(_underlyingToken).balanceOf(
            address(this)
        );
        LendingPool(aaveLendingPool).deposit(
            _underlyingToken,
            _handlerBalance,
            uint16(0)
        );

        // including unexpected transfers.
        uint256 _MarketBalanceAfter = IERC20(_aToken).balanceOf(address(this));

        InterestDetails storage _details = interestDetails[_underlyingToken];
        // Update the stored interest with the market balance after the mint
        uint256 _interest = _MarketBalanceAfter
            .sub(_details.totalUnderlyingBalance)
            .sub(_amount);
        _details.interest = _details.interest.add(_interest);

        // Store the latest real balance.
        _details.totalUnderlyingBalance = _MarketBalanceAfter;

        uint256 _changedAmount = _MarketBalanceAfter.sub(_MarketBalanceBefore);

        // return a smaller value as unexpected transfers were also included.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev Withdraw token from market, but only for dToken contract.
     * @param _underlyingToken Token to withdraw.
     * @param _amount Token amount to withdraw.
     * @return The actual withdrown token amount.
     */
    function withdraw(address _underlyingToken, uint256 _amount)
        external
        whenNotPaused
        auth
        nonReentrant
        returns (uint256)
    {
        require(
            _amount > 0,
            "withdraw: Withdraw amount should be greater than 0!"
        );

        address _aToken = getAToken(_underlyingToken);
        require(_aToken != address(0x0), "withdraw: Do not support token!");

        uint256 _handlerBalanceBefore = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        // aave supports redeem -1
        AToken(_aToken).redeem(_amount);

        uint256 _handlerBalanceAfter = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        uint256 _changedAmount = _handlerBalanceAfter.sub(
            _handlerBalanceBefore
        );

        // including unexpected transfers.
        uint256 _MarketBalanceAfter = IERC20(_aToken).balanceOf(address(this));

        InterestDetails storage _details = interestDetails[_underlyingToken];
        // Update the stored interest with the market balance after the redeem
        uint256 _interest = _MarketBalanceAfter.add(_changedAmount).sub(
            _details.totalUnderlyingBalance
        );
        _details.interest = _details.interest.add(_interest);

        // Store the latest real balance.
        _details.totalUnderlyingBalance = _MarketBalanceAfter;

        // return a smaller value.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev The principal balance.
     * @param _underlyingToken Token to get balance.
     */
    function getUnderlyingBalance(address _underlyingToken)
        internal
        view
        returns (uint256)
    {
        return
            AToken(getAToken(_underlyingToken)).principalBalanceOf(
                address(this)
            );
    }

    /**
     * @dev The corrsponding AToken address of the _underlyingToken.
     * @param _underlyingToken Token to query the AToken.
     */
    function getAToken(address _underlyingToken)
        internal
        view
        returns (address)
    {
        return
            LendingPoolCore(aaveLendingPoolCore).getReserveATokenAddress(
                _underlyingToken
            );
    }

    /**
     * @dev Total balance with any accumulated interest for _underlyingToken belonging to handler
     * @param _underlyingToken Token to get balance.
     */
    function getRealBalance(address _underlyingToken)
        public
        view
        returns (uint256)
    {
        return IERC20(getAToken(_underlyingToken)).balanceOf(address(this));
    }

    /**
     * @dev The maximum withdrawable _underlyingToken in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getRealLiquidity(address _underlyingToken)
        public
        view
        returns (uint256)
    {
        uint256 _underlyingBalance = IERC20(getAToken(_underlyingToken))
            .balanceOf(address(this));
        uint256 _cash = LendingPoolCore(aaveLendingPoolCore)
            .getReserveAvailableLiquidity(_underlyingToken);

        return _underlyingBalance > _cash ? _cash : _underlyingBalance;
    }

    /***************************************************/
    /*** View Interfaces For Backwards compatibility ***/
    /***************************************************/

    /**
     * @dev Total balance with any accumulated interest for `_underlyingToken` belonging to `handler`.
     * @param _underlyingToken Token to get balance.
     */
    function getBalance(address _underlyingToken)
        external
        view
        returns (uint256)
    {
        return getRealBalance(_underlyingToken);
    }

    /**
     * @dev The maximum withdrawable amount of token `_underlyingToken` in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getLiquidity(address _underlyingToken)
        external
        view
        returns (uint256)
    {
        return getRealLiquidity(_underlyingToken);
    }
}
