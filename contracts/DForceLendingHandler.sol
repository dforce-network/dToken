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

    mapping(address => address) public iTokens; //iTokens;

    address public rewardToken;

    event NewMappingiToken(
        address indexed token,
        address indexed mappingiToken
    );

    event RewardClaimed(
        address indexed underlying,
        uint256 indexed rewardBalance
    );

    constructor(address _dTokenController, address _rewardToken) public {
        initialize(_dTokenController, _rewardToken);
    }

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize(address _dTokenController, address _rewardToken)
        public
    {
        super.initialize(_dTokenController);
        rewardToken = _rewardToken;
        initReentrancyStatus();
    }

    /**
     * @dev Authorized function to set iToken address base on underlying token.
     * @param _underlyingTokens Supports underlying tokens in DForce lending.
     * @param _mappingTokens  Corresponding iToken addresses.
     */
    function setiTokensRelation(
        address[] calldata _underlyingTokens,
        address[] calldata _mappingTokens
    ) external auth {
        require(
            _underlyingTokens.length == _mappingTokens.length,
            "setTokensRelation: Array length do not match!"
        );
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            _setiTokenRelation(_underlyingTokens[i], _mappingTokens[i]);
        }
    }

    function _setiTokenRelation(
        address _underlyingToken,
        address _mappingiToken
    ) internal {
        iTokens[_underlyingToken] = _mappingiToken;
        emit NewMappingiToken(_underlyingToken, _mappingiToken);
    }

    /**
     * @dev Authorized function to approves market and dToken to transfer handler's underlying token.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken, uint256 amount) public auth {
        address _iToken = iTokens[_underlyingToken];

        require(
            doApprove(_underlyingToken, _iToken, amount),
            "approve: Approve cToken failed!"
        );

        super.approve(_underlyingToken, amount);
    }

    /**
     * @dev Internal function to transfer rewardToken airdrops to corresponding dToken to distribute.
     */
    function claimReward(address _underlyingToken) external {
        require(
            tokenIsEnabled(_underlyingToken),
            "claimReward: Token is disabled!"
        );
        address _iToken = iTokens[_underlyingToken];
        require(_iToken != address(0x0), "claimReward: Do not support token!");

        address[] memory _holders = new address[](1);
        address[] memory _iTokens = new address[](1);
        _holders[0] = address(this);
        _iTokens[0] = _iToken;
        IiToken(_iToken).controller().rewardDistributor().claimReward(_holders, _iTokens);

        address _rewardToken = rewardToken;
        uint256 _rewardBalance = IERC20(_rewardToken).balanceOf(_holders[0]);
        if (_rewardBalance > 0) {
            address _dToken = IDTokenController(dTokenController).getDToken(_underlyingToken);
            require(
                doTransferOut(_rewardToken, _dToken, _rewardBalance),
                "deposit: Comp transfer out of contract failed."
            );
            emit RewardClaimed(_dToken, _rewardBalance);
        }
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

        address _iToken = iTokens[_underlyingToken];
        require(_iToken != address(0x0), "deposit: Do not support token!");

        uint256 _MarketBalanceBefore = IiToken(_iToken).balanceOfUnderlying(
            address(this)
        );

        // Update the stored interest with the market balance before the mint
        InterestDetails storage _details = interestDetails[_underlyingToken];
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
        IiToken(_iToken).mint(address(this), _handlerBalance);

        // claimComp(_underlyingToken);

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

        address _iToken = iTokens[_underlyingToken];
        require(_iToken != address(0x0), "withdraw: Do not support token!");

        uint256 _MarketBalanceBefore = IiToken(_iToken).balanceOfUnderlying(
            address(this)
        );

        // Update the stored interest with the market balance before the redeem
        InterestDetails storage _details = interestDetails[_underlyingToken];
        uint256 _interest = _MarketBalanceBefore.sub(
            _details.totalUnderlyingBalance
        );
        _details.interest = _details.interest.add(_interest);

        uint256 _handlerBalanceBefore = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        // Redeem all or just the amount of underlying token
        if (_amount == uint256(-1)) {
            IiToken(_iToken).redeem(address(this), IERC20(_iToken).balanceOf(address(this)));
        } else {
            IiToken(_iToken).redeemUnderlying(address(this), _amount);
        }

        // claimComp(_underlyingToken);

        uint256 _handlerBalanceAfter = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        // Store the latest real balance.
        _details.totalUnderlyingBalance = IiToken(_iToken)
            .balanceOfUnderlying(address(this));

        uint256 _changedAmount = _handlerBalanceAfter.sub(
            _handlerBalanceBefore
        );

        // return a smaller value.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev Update exchange rate in cToken and get the latest total balance for
     *      handler's _underlyingToken, with all accumulated interest included.
     * @param _underlyingToken Token to get actual balance.
     */
    function getRealBalance(address _underlyingToken)
        external
        returns (uint256)
    {
        return
            IiToken(iTokens[_underlyingToken]).balanceOfUnderlying(
                address(this)
            );
    }

    /**
     * @dev The latest maximum withdrawable _underlyingToken in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getRealLiquidity(address _underlyingToken)
        external
        returns (uint256)
    {
        address _iToken = iTokens[_underlyingToken];
        uint256 _underlyingBalance = IiToken(_iToken).balanceOfUnderlying(
            address(this)
        );
        uint256 _cash = IiToken(_iToken).getCash();

        return _underlyingBalance > _cash ? _cash : _underlyingBalance;
    }

    /***************************************************/
    /*** View Interfaces For Backwards compatibility ***/
    /***************************************************/

    /**
     * @dev Total balance of handler's _underlyingToken, accumulated interest included
     * @param _underlyingToken Token to get balance.
     */
    function getBalance(address _underlyingToken)
        public
        view
        returns (uint256)
    {
        address _iToken = iTokens[_underlyingToken];
        uint256 _iTokenBalance = IERC20(_iToken).balanceOf(address(this));
        uint256 _exchangeRate = IiToken(_iToken).exchangeRateStored();

        return _iTokenBalance.mul(_exchangeRate) / BASE;
    }

    /**
     * @dev The maximum withdrawable amount of _underlyingToken in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getLiquidity(address _underlyingToken)
        external
        view
        returns (uint256)
    {
        address _iToken = iTokens[_underlyingToken];
        uint256 _underlyingBalance = getBalance(_underlyingToken);
        uint256 _cash = IiToken(_iToken).getCash();

        return _underlyingBalance > _cash ? _cash : _underlyingBalance;
    }
}
