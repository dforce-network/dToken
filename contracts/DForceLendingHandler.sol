pragma solidity 0.5.12;

import "./Handler.sol";
import "./interface/IDForceLending.sol";
import "./library/ReentrancyGuard.sol";

contract DForceLendingHandler is Handler, ReentrancyGuard {
    uint256 constant BASE = 10**18;

    struct InterestDetails {
        uint256 totalUnderlyingBalance; // Total underlying balance including interest
        uint256 interest; // Total interest
    }
    // Based on underlying token, get current interest details
    mapping(address => InterestDetails) public interestDetails;
    
    IController public controller;
    IiToken public iToken;
    address public underlying;

    event RewardClaimed(
        address indexed _underlying,
        uint256 indexed compBalance
    );

    constructor(address _dTokenController, IiToken _iToken) public {
        initialize(_dTokenController, _iToken);
    }

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize(address _dTokenController, IiToken _iToken)
        public
    {
        super.initialize(_dTokenController);
        require(_iToken.isiToken(), "Token is not a iToken");
        iToken = _iToken;
        
        controller = _iToken.controller();
        underlying = _iToken.underlying();
        initReentrancyStatus();
        approve(uint256(-1));
        _enableToken(underlying);
    }

    /**
     * @dev Authorized function to approves market and dToken to transfer handler's underlying token.
     */
    function approve(uint256 _amount) public auth {

        require(
            doApprove(underlying, address(iToken), _amount),
            "approve: Approve cToken failed!"
        );

        approve(underlying, _amount);
    }

    /**
     * @dev Deposit token to market, only called by dToken contract.
     * @param _underlying Token to deposit.
     * @return The actual deposited token amount.
     */
    function deposit(address _underlying, uint256 _amount)
        external
        whenNotPaused
        auth
        nonReentrant
        returns (uint256)
    {
        require(
            underlying == _underlying,
            "deposit: Token is disabled!"
        );
        require(
            _amount > 0,
            "deposit: Deposit amount should be greater than 0!"
        );

        IiToken _iToken = iToken;
        require(address(_iToken) != address(0), "deposit: Do not support token!");

        uint256 _MarketBalanceBefore = _iToken.balanceOfUnderlying(address(this));

        // Update the stored interest with the market balance before the mint
        InterestDetails storage _details = interestDetails[_underlying];
        uint256 _interest = _MarketBalanceBefore.sub(
            _details.totalUnderlyingBalance
        );
        _details.interest = _details.interest.add(_interest);

        // Mint all the token balance of the handler,
        // which should be the exact deposit amount normally,
        // but there could be some unexpected transfers before.
        _iToken.mint(address(this), IERC20(_underlying).balanceOf(address(this)));

        // including unexpected transfers.
        uint256 _MarketBalanceAfter = IiToken(_iToken).balanceOfUnderlying(
            address(this)
        );

        // Store the latest real balance.
        _details.totalUnderlyingBalance = _MarketBalanceAfter;

        uint256 _changedAmount = _MarketBalanceAfter.sub(_MarketBalanceBefore);

        // Return the smaller value as unexpected transfers were also included.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev Withdraw token from market, but only for dToken contract.
     * @param _underlying Token to withdraw.
     * @param _amount Token amount to withdraw.
     * @return The actual withdrown token amount.
     */
    function withdraw(address _underlying, uint256 _amount)
        external
        whenNotPaused
        auth
        nonReentrant
        returns (uint256)
    {
        require(
            underlying == _underlying,
            "withdraw: Token is disabled!"
        );

        require(
            _amount > 0,
            "withdraw: Withdraw amount should be greater than 0!"
        );

        IiToken _iToken = iToken;
        // address _cToken = cTokens[_underlying];
        require(address(_iToken) != address(0), "withdraw: Do not support token!");

        uint256 _MarketBalanceBefore = _iToken.balanceOfUnderlying(address(this));

        // Update the stored interest with the market balance before the redeem
        InterestDetails storage _details = interestDetails[_underlying];
        uint256 _interest = _MarketBalanceBefore.sub(
            _details.totalUnderlyingBalance
        );
        _details.interest = _details.interest.add(_interest);

        uint256 _handlerBalanceBefore = IERC20(_underlying).balanceOf(
            address(this)
        );

        // Redeem all or just the amount of underlying token
        if (_amount == uint256(-1)) {
            _iToken.redeem(address(this),  IERC20(address(_iToken)).balanceOf(address(this)));
        } else {
            _iToken.redeemUnderlying(address(this), _amount);
        }

        // Store the latest real balance.
        _details.totalUnderlyingBalance = _iToken.balanceOfUnderlying(address(this));

        uint256 _changedAmount = IERC20(_underlying).balanceOf(address(this)).sub(
            _handlerBalanceBefore
        );

        // return a smaller value.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev external function to transfer reward token airdrops to corresponding dToken to distribute.
     */
    function claimReward() external {
        address[] memory _holders = new address[](1);
        address[] memory _iTokens = new address[](1);
        _holders[0] = address(this);
        _iTokens[0] = address(iToken);
        controller.rewardDistributor().claimReward(_holders, _iTokens);

        address _rewardToken = controller.rewardDistributor().rewardToken();
        uint256 _rewardBalance = IERC20(_rewardToken).balanceOf(_holders[0]);
        if (_rewardBalance > 0) {
            address _dToken = IDTokenController(dTokenController).getDToken(underlying);
            require(
                doTransferOut(_rewardToken, _dToken, _rewardBalance),
                "deposit: Comp transfer out of contract failed."
            );
            emit RewardClaimed(_dToken, _rewardBalance);
        }
    }

    /**
     * @dev Update exchange rate in cToken and get the latest total balance for
     *      handler's _underlying, with all accumulated interest included.
     * @param _underlying Token to get actual balance.
     */
    function getRealBalance(address _underlying)
        external
        returns (uint256)
    {
        _underlying;
        return iToken.balanceOfUnderlying(address(this));
    }

    /**
     * @dev The latest maximum withdrawable _underlying in the market.
     * @param _underlying Token to get liquidity.
     */
    function getRealLiquidity(address _underlying)
        external
        returns (uint256)
    {
        _underlying;
        IiToken _iToken = iToken;
        uint256 _underlyingBalance = _iToken.balanceOfUnderlying(address(this));
        uint256 _cash = _iToken.getCash();

        return _underlyingBalance > _cash ? _cash : _underlyingBalance;
    }

    /***************************************************/
    /*** View Interfaces For Backwards compatibility ***/
    /***************************************************/

    /**
     * @dev Total balance of handler's _underlying, accumulated interest included
     * @param _underlying Token to get balance.
     */
    function getBalance(address _underlying)
        public
        view
        returns (uint256)
    {
        _underlying;
        IiToken _iToken = iToken;
        return IERC20(address(_iToken)).balanceOf(address(this)).mul(_iToken.exchangeRateStored()) / BASE;
    }

    /**
     * @dev The maximum withdrawable amount of _underlying in the market.
     * @param _underlying Token to get liquidity.
     */
    function getLiquidity(address _underlying)
        external
        view
        returns (uint256)
    {
        uint256 _underlyingBalance = getBalance(_underlying);
        uint256 _cash = iToken.getCash();

        return _underlyingBalance > _cash ? _cash : _underlyingBalance;
    }
}
