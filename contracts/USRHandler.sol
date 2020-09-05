pragma solidity 0.5.12;

import "./Handler.sol";
import "./interface/IUSR.sol";
import "./library/ReentrancyGuard.sol";

contract USRHandler is Handler, ReentrancyGuard {
    address public USR;

    struct InterestDetails {
        uint256 totalUnderlyingBalance; // Total underlying balance including interest
        uint256 interest; // Total interest
    }
    // Based on underlying token, get current interest details
    mapping(address => InterestDetails) public interestDetails;

    constructor(address _dTokenController, address _USR) public {
        initialize(_dTokenController, _USR);
    }

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize(address _dTokenController, address _USR) public {
        super.initialize(_dTokenController);
        initReentrancyStatus();
        USR = _USR;
    }

    function setUSR(address _USR) external auth {
        USR = _USR;
    }

    /**
     * @dev Authorized function to approves market and dToken to transfer handler's underlying token.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken, uint256 amount) public auth {
        require(
            IUSR(USR).underlyingToken() == _underlyingToken,
            "approve: Do not support token!"
        );

        require(
            doApprove(_underlyingToken, USR, amount),
            "approve: Approve USR failed!"
        );

        super.approve(_underlyingToken, amount);
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
            _amount > 0,
            "deposit: Deposit amount should be greater than 0!"
        );

        address _USR = USR;
        require(
            IUSR(_USR).underlyingToken() == _underlyingToken,
            "deposit: Do not support token!"
        );

        uint256 _MarketBalanceBefore = getRealBalance(_underlyingToken);

        InterestDetails storage _details = interestDetails[_underlyingToken];
        // Update the stored interest with the market balance after the mint
        uint256 _interest = _MarketBalanceBefore.sub(
            _details.totalUnderlyingBalance
        );
        _details.interest = _details.interest.add(_interest);

        // Mint all the token balance of the handler,
        // which should be the exact deposit amount normally,
        // but there could be some unexpected transfers before.
        uint256 _handlerBalance = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        IUSR(_USR).mint(address(this), _handlerBalance);

        // including unexpected transfers.
        uint256 _MarketBalanceAfter = getRealBalance(_underlyingToken);

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

        address _USR = USR;
        require(
            IUSR(_USR).underlyingToken() == _underlyingToken,
            "withdraw: Do not support token!"
        );

        uint256 _handlerBalanceBefore = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        uint256 _MarketBalanceBefore = getRealBalance(_underlyingToken);
        InterestDetails storage _details = interestDetails[_underlyingToken];
        // Update the stored interest with the market balance after the redeem
        uint256 _interest = _MarketBalanceBefore.sub(
            _details.totalUnderlyingBalance
        );
        _details.interest = _details.interest.add(_interest);

        // Redeem all or just the amount of underlying token
        if (_amount == uint256(-1)) {
            IUSR(_USR).redeem(
                address(this),
                IERC20(_USR).balanceOf(address(this))
            );
        } else {
            IUSR(_USR).redeemUnderlying(address(this), _amount);
        }

        uint256 _handlerBalanceAfter = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        uint256 _changedAmount = _handlerBalanceAfter.sub(
            _handlerBalanceBefore
        );

        // including unexpected transfers.
        uint256 _MarketBalanceAfter = getRealBalance(_underlyingToken);

        // Store the latest real balance.
        _details.totalUnderlyingBalance = _MarketBalanceAfter;

        // return a smaller value.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev Total balance with any accumulated interest for _underlyingToken belonging to handler
     * @param _underlyingToken Token to get balance.
     */
    function getRealBalance(address _underlyingToken) public returns (uint256) {
        _underlyingToken;
        return IUSR(USR).balanceOfUnderlying(address(this));
    }

    /**
     * @dev The maximum withdrawable _underlyingToken in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getRealLiquidity(address _underlyingToken)
        public
        returns (uint256)
    {
        return getRealBalance(_underlyingToken);
    }

    /***************************************************/
    /*** View Interfaces For Backwards compatibility ***/
    /***************************************************/

    /**
     * @dev Total balance with any accumulated interest for `_underlyingToken` belonging to `handler`.
     * @param _underlyingToken Token to get balance.
     */
    function getBalance(address _underlyingToken) external returns (uint256) {
        return getRealBalance(_underlyingToken);
    }

    /**
     * @dev The maximum withdrawable amount of token `_underlyingToken` in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getLiquidity(address _underlyingToken) external returns (uint256) {
        return getRealLiquidity(_underlyingToken);
    }
}
