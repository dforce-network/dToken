pragma solidity 0.5.12;

import "./Handler.sol";
import "./interface/IVenus.sol";
import "./library/ReentrancyGuard.sol";

contract VenusHandler is Handler, ReentrancyGuard {
    uint256 constant BASE = 10**18;

    struct InterestDetails {
        uint256 totalUnderlyingBalance; // Total underlying balance including interest
        uint256 interest; // Total interest
    }
    // Based on underlying token, get current interest details
    mapping(address => InterestDetails) public interestDetails;

    mapping(address => address) public vTokens; //vTokens;

    address public rewardToken;

    event NewMappingvToken(
        address indexed token,
        address indexed mappingvToken
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
     * @dev Authorized function to set vToken address base on underlying token.
     * @param _underlyingTokens Supports underlying tokens in Venus.
     * @param _mappingTokens  Corresponding vToken addresses.
     */
    function setvTokensRelation(
        address[] calldata _underlyingTokens,
        address[] calldata _mappingTokens
    ) external auth {
        require(
            _underlyingTokens.length == _mappingTokens.length,
            "setTokensRelation: Array length do not match!"
        );
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            _setvTokenRelation(_underlyingTokens[i], _mappingTokens[i]);
        }
    }

    function _setvTokenRelation(
        address _underlyingToken,
        address _mappingvToken
    ) internal {
        vTokens[_underlyingToken] = _mappingvToken;
        emit NewMappingvToken(_underlyingToken, _mappingvToken);
    }

    /**
     * @dev Authorized function to approves market and dToken to transfer handler's underlying token.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken, uint256 amount) public auth {
        address _vToken = vTokens[_underlyingToken];

        require(
            doApprove(_underlyingToken, _vToken, amount),
            "approve: Approve vToken failed!"
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
        address _vToken = vTokens[_underlyingToken];
        require(_vToken != address(0x0), "claimReward: Do not support token!");

        address[] memory _holders = new address[](1);
        address[] memory _vTokens = new address[](1);
        _holders[0] = address(this);
        _vTokens[0] = _vToken;
        IvToken(_vToken).comptroller().claimVenus(_holders, _vTokens, false, true);

        address _rewardToken = rewardToken;
        uint256 _rewardBalance = IERC20(_rewardToken).balanceOf(_holders[0]);
        if (_rewardBalance > 0) {
            address _dToken = IDTokenController(dTokenController).getDToken(_underlyingToken);
            require(
                doTransferOut(_rewardToken, _dToken, _rewardBalance),
                "deposit: reward token transfer out of contract failed."
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

        address _vToken = vTokens[_underlyingToken];
        require(_vToken != address(0x0), "deposit: Do not support token!");

        uint256 _MarketBalanceBefore = IvToken(_vToken).balanceOfUnderlying(
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
        require(
            IvToken(_vToken).mint(_handlerBalance) == 0,
            "deposit: Fail to supply to Venus!"
        );

        // claimComp(_underlyingToken);

        // including unexpected transfers.
        uint256 _MarketBalanceAfter = IvToken(_vToken).balanceOfUnderlying(
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

        address _vToken = vTokens[_underlyingToken];
        require(_vToken != address(0x0), "withdraw: Do not support token!");

        uint256 _MarketBalanceBefore = IvToken(_vToken).balanceOfUnderlying(
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
            require(
                IvToken(_vToken).redeem(
                    IERC20(_vToken).balanceOf(address(this))
                ) == 0,
                "withdraw: Fail to withdraw from market!"
            );
        } else {
            require(
                IvToken(_vToken).redeemUnderlying(_amount) == 0,
                "withdraw: Fail to withdraw from market!"
            );
        }

        // claimComp(_underlyingToken);

        uint256 _handlerBalanceAfter = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        // Store the latest real balance.
        _details.totalUnderlyingBalance = IvToken(_vToken)
            .balanceOfUnderlying(address(this));

        uint256 _changedAmount = _handlerBalanceAfter.sub(
            _handlerBalanceBefore
        );

        // return a smaller value.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev Update exchange rate in vToken and get the latest total balance for
     *      handler's _underlyingToken, with all accumulated interest included.
     * @param _underlyingToken Token to get actual balance.
     */
    function getRealBalance(address _underlyingToken)
        external
        returns (uint256)
    {
        return
            IvToken(vTokens[_underlyingToken]).balanceOfUnderlying(
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
        address _vToken = vTokens[_underlyingToken];
        uint256 _underlyingBalance = IvToken(_vToken).balanceOfUnderlying(
            address(this)
        );
        uint256 _cash = IvToken(_vToken).getCash();

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
        address _vToken = vTokens[_underlyingToken];
        uint256 _vTokenBalance;
        uint256 _exchangeRate;
        uint256 _error;
        (_error, _vTokenBalance, , _exchangeRate) = IvToken(_vToken)
            .getAccountSnapshot(address(this));
        if (_error != 0) {
            return 0;
        }

        return _vTokenBalance.mul(_exchangeRate) / BASE;
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
        address _vToken = vTokens[_underlyingToken];
        uint256 _underlyingBalance = getBalance(_underlyingToken);
        uint256 _cash = IvToken(_vToken).getCash();

        return _underlyingBalance > _cash ? _cash : _underlyingBalance;
    }
}
