pragma solidity 0.5.12;

import "./DTokenController.sol";
import "./library/ReentrancyGuard.sol";
import "./interface/ICompound.sol";
import "./library/ERC20SafeTransfer.sol";
import "./library/Pausable.sol";
import "./library/SafeMath.sol";

contract CompoundHandler is ERC20SafeTransfer, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    bool private initialized; // Flags for initializing data
    uint256 internal BASE;
    address public dTokenController; // dToken mapping contract

    struct InterestDetails {
        uint256 totalUnderlyingBalance; // Total underlying balance including interest
        uint256 interest; // Total interest
    }
    // Based on underlying token, get current interest details
    mapping(address => InterestDetails) public interestsDetails;

    mapping(address => bool) private tokensEnable; // Supports token or not

    mapping(address => address) internal cTokens; //cTokens;

    event NewMappingcToken(
        address indexed token,
        address indexed mappingcToken
    );
    event NewdTokenAddresses(
        address indexed originaldToken,
        address indexed newdToken
    );
    event DisableToken(address indexed underlyingToken);
    event EnableToken(address indexed underlyingToken);

    constructor(address _dTokenController) public {
        initialize(_dTokenController);
    }

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize(address _dTokenController) public {
        require(!initialized, "initialize: Already initialized!");
        owner = msg.sender;
        dTokenController = _dTokenController;
        notEntered = true;
        BASE = 1e18;
        initialized = true;
    }

    /**
     * @dev Update dToken mapping contract.
     * @param _newDTokenController The new dToken mapping contact.
     */
    function setdTokens(address _newDTokenController) external auth {
        require(
            _newDTokenController != dTokenController,
            "setdTokens: The same dToken mapping contract address!"
        );
        address _originaldTokens = dTokenController;
        dTokenController = _newDTokenController;
        emit NewdTokenAddresses(_originaldTokens, _newDTokenController);
    }

    /**
     * @dev Authorized function to disable some underlying tokens.
     * @param _underlyingTokens Tokens to disable.
     */
    function disableTokens(address[] calldata _underlyingTokens) external auth {
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            _disableToken(_underlyingTokens[i]);
        }
    }

    /**
     * @dev Authorized function to enable some underlying tokens.
     * @param _underlyingTokens Tokens to enable.
     */
    function enableTokens(address[] calldata _underlyingTokens) external auth {
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            _enableToken(_underlyingTokens[i]);
        }
    }

    function _disableToken(address _underlyingToken) internal {
        require(
            tokensEnable[_underlyingToken],
            "disableToken: Has been disabled!"
        );
        tokensEnable[_underlyingToken] = false;
        emit DisableToken(_underlyingToken);
    }

    function _enableToken(address _underlyingToken) internal {
        require(
            !tokensEnable[_underlyingToken],
            "enableToken: Has been enabled!"
        );
        tokensEnable[_underlyingToken] = true;
        emit EnableToken(_underlyingToken);
    }

    /**
     * @dev Authorized function to set cToken address base on underlying token.
     * @param _underlyingTokens Supports underlying tokens in Compound.
     * @param _mappingTokens  Corresponding cToken addresses.
     */
    function setcTokensRelation(
        address[] calldata _underlyingTokens,
        address[] calldata _mappingTokens
    ) external auth {
        require(
            _underlyingTokens.length == _mappingTokens.length,
            "setTokensRelation: Array length do not match!"
        );
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            _setcTokenRelation(_underlyingTokens[i], _mappingTokens[i]);
        }
    }

    function _setcTokenRelation(
        address _underlyingToken,
        address _mappingcToken
    ) internal {
        cTokens[_underlyingToken] = _mappingcToken;
        emit NewMappingcToken(_underlyingToken, _mappingcToken);
    }

    // function rdivup(uint256 x, uint256 y) internal view returns (uint256 z) {
    //     z = x.mul(BASE).add(y.sub(1)) / y;
    // }

    /**
     * @dev This token `_underlyingToken` approves to market and dToken contract.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken) external auth {
        address _cToken = cTokens[_underlyingToken];
        address _dToken = DTokenController(dTokenController).getdToken(
            _underlyingToken
        );

        if (
            IERC20(_underlyingToken).allowance(address(this), _cToken) !=
            uint256(-1)
        ) {
            require(
                doApprove(_underlyingToken, _cToken, uint256(-1)),
                "approve: Approve cToken failed!"
            );
        }

        if (
            IERC20(_underlyingToken).allowance(address(this), _dToken) !=
            uint256(-1)
        ) {
            require(
                doApprove(_underlyingToken, _dToken, uint256(-1)),
                "approve: Approve dToken failed!"
            );
        }
    }

    /**
     * @dev Deposit token to market, but only for dToken contract.
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
        require(tokensEnable[_underlyingToken], "deposit: Token is disabled!");
        require(
            _amount > 0,
            "deposit: Deposit amount should be greater than 0!"
        );

        address _cToken = cTokens[_underlyingToken];
        require(_cToken != address(0x0), "deposit: Do not support token!");

        uint256 _MarketBalanceBefore = getRealBalance(_underlyingToken);

        // Update the stored interest with the market balance before the mint
        InterestDetails storage interest = interestsDetails[_underlyingToken];
        uint256 _periodInterest = _MarketBalanceBefore.sub(
            interest.totalUnderlyingBalance
        );
        interest.interest = interest.interest.add(_periodInterest);

        // Mint all the token balance of the handler,
        // which should be the exact deposit amount normally,
        // but there could be some unexpected transfers before.
        uint256 _handlerBalance = IERC20(_underlyingToken).balanceOf(
            address(this)
        );
        require(
            ICompound(_cToken).mint(_handlerBalance) == 0,
            "deposit: Fail to supply to compound!"
        );

        // including unexpected transfers.
        uint256 _MarketBalanceAfter = getRealBalance(_underlyingToken);

        // Store the latest real balance.
        interest.totalUnderlyingBalance = _MarketBalanceAfter;

        uint256 _changedAmount = _MarketBalanceAfter.sub(_MarketBalanceBefore);

        // Return the smaller value as unexpected transfers were also included.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev Withdraw token from market, but only for dToken contract.
     * @param _underlyingToken Token to withdraw.
     * @param _amount Token amount to withdraw.
     * @return The actual withdrawed token amount.
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

        address _cToken = cTokens[_underlyingToken];
        require(_cToken != address(0x0), "withdraw: Do not support token!");

        uint256 _MarketBalanceBefore = getRealBalance(_underlyingToken);

        // Update the stored interest with the market balance before the redeem
        InterestDetails storage interest = interestsDetails[_underlyingToken];
        uint256 _periodInterest = _MarketBalanceBefore.sub(
            interest.totalUnderlyingBalance
        );
        interest.interest = interest.interest.add(_periodInterest);

        uint256 _handlerBalanceBefore = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        // Redeem all or just the amount of underlying token
        // uint256 _redeemAmount = _amount == uint256(-1)
        //     ? ICompound(_cToken).balanceOf(address(this))
        //     : rdivup(_amount, ICompound(_cToken).exchangeRateCurrent());
        if (_amount == uint256(-1)) {
            require(
                ICompound(_cToken).redeem(
                    ICompound(_cToken).balanceOf(address(this))
                ) == 0,
                "withdraw: Fail to withdraw from market!"
            );
        } else {
            require(
                ICompound(_cToken).redeemUnderlying(_amount) == 0,
                "withdraw: Fail to withdraw from market!"
            );
        }

        uint256 _handlerBalanceAfter = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        // Store the latest real balance.
        interest.totalUnderlyingBalance = getRealBalance(_underlyingToken);

        uint256 _changedAmount = _handlerBalanceAfter.sub(
            _handlerBalanceBefore
        );

        // return a smaller value.
        return _changedAmount > _amount ? _amount : _changedAmount;
    }

    /**
     * @dev Support token or not.
     * @param _underlyingToken Token to check.
     */
    function tokenIsEnabled(address _underlyingToken)
        public
        view
        returns (bool)
    {
        return tokensEnable[_underlyingToken];
    }

    /**
     * @dev Deposit balance with any accumulated interest for `_underlyingToken` belonging to `handler`
     * @param _underlyingToken Token to get balance.
     */
    function getBalance(address _underlyingToken)
        public
        view
        returns (uint256)
    {
        address _cToken = cTokens[_underlyingToken];
        uint256 _cTokenBalance;
        uint256 _exchangeRate;
        uint256 _error;
        (_error, _cTokenBalance, , _exchangeRate) = ICompound(_cToken)
            .getAccountSnapshot(address(this));
        if (_error != 0) {
            return 0;
        }

        return _cTokenBalance.mul(_exchangeRate) / BASE;
    }

    /**
     * @dev The maximum withdrawable amount of token `_underlyingToken` in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getLiquidity(address _underlyingToken)
        public
        view
        returns (uint256)
    {
        address _cToken = cTokens[_underlyingToken];
        uint256 _underlyingBalance = getBalance(_underlyingToken);
        if (_underlyingBalance == 0) {
            return 0;
        }

        uint256 _cash = ICompound(_cToken).getCash();

        if (_underlyingBalance > _cash) {
            return _cash;
        }

        return _underlyingBalance;
    }

    /**
     * @dev Update exchange rate in cToken and get the latest total balance with any accumulated interest
     *      for `_underlyingToken` belonging to `handler`.
     * @param _underlyingToken Token to get actual balance.
     */
    function getRealBalance(address _underlyingToken) public returns (uint256) {
        address _cToken = cTokens[_underlyingToken];

        return ICompound(_cToken).balanceOfUnderlying(address(this));
    }

    /**
     * @dev The latest maximum withdrawable amount of token `_underlyingToken` in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getRealLiquidity(address _underlyingToken)
        public
        returns (uint256)
    {
        address _cToken = cTokens[_underlyingToken];
        uint256 _underlyingBalance = getRealBalance(_underlyingToken);
        if (_underlyingBalance == 0) {
            return 0;
        }

        uint256 _cash = ICompound(_cToken).getCash();

        if (_underlyingBalance > _cash) {
            return _cash;
        }

        return _underlyingBalance;
    }

    /**
     * @dev The corrsponding CToken address of the _underlyingToken.
     * @param _underlyingToken Token to query the CToken.
     */
    function getcToken(address _underlyingToken)
        external
        view
        returns (address)
    {
        return cTokens[_underlyingToken];
    }
}
