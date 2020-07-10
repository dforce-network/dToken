pragma solidity 0.5.12;

import "./Handler.sol";
import "./interface/ILendFMe.sol";
import "./library/ReentrancyGuard.sol";

contract MoneyMarketHandler is Handler, ReentrancyGuard {
    address public targetAddr; // market address

    mapping(address => uint256) public interestDetails;

    event NewdTargetAddr(
        address indexed originalTargetAddr,
        address indexed newTargetAddr
    );

    constructor(address _dTokenController, address _targetAddr) public {
        initialize(_dTokenController, _targetAddr);
    }

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize(address _dTokenController, address _targetAddr) public {
        super.initialize(_dTokenController);
        initReentrancyStatus();
        targetAddr = _targetAddr;
    }

    /**
     * @dev Update market contract address.
     * @param _newTargetAddr The new market contract address.
     */
    function setTargetAddr(address _newTargetAddr) external auth {
        require(
            _newTargetAddr != targetAddr,
            "setTargetAddr: The same market address!"
        );
        address _originalTargetAddr = targetAddr;
        targetAddr = _newTargetAddr;
        emit NewdTargetAddr(_originalTargetAddr, _newTargetAddr);
    }

    /**
     * @dev This token `_underlyingToken` approves to market and dToken contract.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken, uint256 amount) public auth {
        require(
            doApprove(_underlyingToken, targetAddr, amount),
            "approve: Approve market failed!"
        );

        super.approve(_underlyingToken, amount);
    }

    /**
     * @dev Deposit token to market, but only for dToken contract.
     * @param _underlyingToken Token to deposit.
     * @return True is success, false is failure.
     */
    function deposit(address _underlyingToken, uint256 _amount)
        external
        auth
        whenNotPaused
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

        // Update the stored interest with the market balance before the deposit
        uint256 _MarketBalanceBefore = _updateInterest(_underlyingToken);

        // Mint all the token balance of the handler,
        // which should be the exact deposit amount normally,
        // but there could be some unexpected transfers before.
        uint256 _handlerBalance = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        require(
            ILendFMe(targetAddr).supply(_underlyingToken, _handlerBalance) == 0,
            "deposit: Fail to supply to money market!"
        );

        // including unexpected transfers.
        uint256 _MarketBalanceAfter = getBalance(_underlyingToken);

        uint256 _changedAmount = _MarketBalanceAfter.sub(_MarketBalanceBefore);

        // return a smaller value as unexpected transfers were also included.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev Withdraw token from market, but only for dToken contract.
     * @param _underlyingToken Token to withdraw.
     * @param _amount Token amount to withdraw.
     * @return Actually withdraw token amount.
     */
    function withdraw(address _underlyingToken, uint256 _amount)
        external
        auth
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        require(
            _amount > 0,
            "withdraw: Withdraw amount should be greater than 0!"
        );

        _updateInterest(_underlyingToken);

        uint256 _handlerBalanceBefore = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        require(
            ILendFMe(targetAddr).withdraw(_underlyingToken, _amount) == 0,
            "withdraw: Fail to withdraw from money market!"
        );

        // including unexpected transfer.
        uint256 _handlerBalanceAfter = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        uint256 _changedAmount = _handlerBalanceAfter.sub(
            _handlerBalanceBefore
        );

        // return a smaller value.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev Update the handler deposit interest based on the underlying token.
     */
    function _updateInterest(address _underlyingToken)
        internal
        returns (uint256)
    {
        uint256 _balance = getBalance(_underlyingToken);
        (uint256 _underlyingBalance, ) = ILendFMe(targetAddr).supplyBalances(
            address(this),
            _underlyingToken
        );

        // Interest = Balance - UnderlyingBalance.
        uint256 _interest = _balance.sub(_underlyingBalance);

        // Update the stored interest
        interestDetails[_underlyingToken] = interestDetails[_underlyingToken]
            .add(_interest);

        return _balance;
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
        return
            ILendFMe(targetAddr).getSupplyBalance(
                address(this),
                _underlyingToken
            );
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
        uint256 _underlyingBalance = getRealBalance(_underlyingToken);
        uint256 _cash = IERC20(_underlyingToken).balanceOf(targetAddr);

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
        public
        view
        returns (uint256)
    {
        return getRealBalance(_underlyingToken);
    }

    /**
     * @dev The maximum withdrawable amount of token `_underlyingToken` in the market.
     * @param _underlyingToken Token to get balance.
     */
    function getLiquidity(address _underlyingToken)
        public
        view
        returns (uint256)
    {
        return getRealLiquidity(_underlyingToken);
    }
}
