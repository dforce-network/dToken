pragma solidity 0.5.12;

import "./Handler.sol";
import "./interface/ICompound.sol";
import "./library/ReentrancyGuard.sol";
import "./library/ERC20SafeTransfer.sol";

contract CompoundHandler is Handler, ReentrancyGuard {
    uint256 constant BASE = 10**18;

    struct InterestDetails {
        uint256 totalUnderlyingBalance; // Total underlying balance including interest
        uint256 interest; // Total interest
    }
    // Based on underlying token, get current interest details
    mapping(address => InterestDetails) public interestDetails;

    mapping(address => address) public cTokens; //cTokens;

    address public compAddress;

    event NewMappingcToken(
        address indexed token,
        address indexed mappingcToken
    );

    constructor(address _dTokenController, address _compAddress) public {
        super.initialize(_dTokenController);
        compAddress = _compAddress;
        initReentrancyStatus();
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

    /**
     * @dev Authorized function to approves market and dToken to transfer handler's underlying token.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken, uint256 amount) public auth {
        address _cToken = cTokens[_underlyingToken];

        require(
            doApprove(_underlyingToken, _cToken, amount),
            "approve: Approve cToken failed!"
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
            tokenIsEnabled(_underlyingToken),
            "deposit: Token is disabled!"
        );
        require(
            _amount > 0,
            "deposit: Deposit amount should be greater than 0!"
        );

        address _dToken = IDTokenController(dTokenController).getDToken(
            _underlyingToken
        );

        address _cToken = cTokens[_underlyingToken];
        require(_cToken != address(0x0), "deposit: Do not support token!");

        uint256 _MarketBalanceBefore = ICompound(_cToken).balanceOfUnderlying(
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
            ICompound(_cToken).mint(_handlerBalance) == 0,
            "deposit: Fail to supply to compound!"
        );

        uint256 compBalance = IERC20(compAddress).balanceOf(address(this));
        if (compBalance > 0) {
            require(
                doTransferOut(compAddress, _dToken, compBalance),
                "deposit: Comp transfer out of contract failed."
            );
        }

        // including unexpected transfers.
        uint256 _MarketBalanceAfter = ICompound(_cToken).balanceOfUnderlying(
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

        address _cToken = cTokens[_underlyingToken];
        require(_cToken != address(0x0), "withdraw: Do not support token!");

        uint256 _MarketBalanceBefore = ICompound(_cToken).balanceOfUnderlying(
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
                ICompound(_cToken).redeem(
                    IERC20(_cToken).balanceOf(address(this))
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
        _details.totalUnderlyingBalance = ICompound(_cToken)
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
            ICompound(cTokens[_underlyingToken]).balanceOfUnderlying(
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
        address _cToken = cTokens[_underlyingToken];
        uint256 _underlyingBalance = ICompound(_cToken).balanceOfUnderlying(
            address(this)
        );
        uint256 _cash = ICompound(_cToken).getCash();

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
     * @dev The maximum withdrawable amount of _underlyingToken in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getLiquidity(address _underlyingToken)
        external
        view
        returns (uint256)
    {
        address _cToken = cTokens[_underlyingToken];
        uint256 _underlyingBalance = getBalance(_underlyingToken);
        uint256 _cash = ICompound(_cToken).getCash();

        return _underlyingBalance > _cash ? _cash : _underlyingBalance;
    }
}
