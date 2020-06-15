pragma solidity 0.5.12;

import "./dTokenAddresses.sol";
import "./helpers/ReentrancyGuard.sol";
import "./interface/ICompound.sol";
import "./library/ERC20SafeTransfer.sol";
import "./library/Pausable.sol";
import "./library/SafeMath.sol";

contract CompoundHandler is ERC20SafeTransfer, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    bool private initialized; // Flags for initializing data
    uint256 internal BASE;
    address public dTokens; // dToken mapping contract

    struct InterestsDetails {
        uint256 underlyingBalance; // Total underlying balance including interests
        uint256 interests; // Total interests
    }
    // Based on underlying token, get current interests
    mapping(address => InterestsDetails) public interestsDetails;

    mapping(address => bool) public tokensEnable; // Supports token or no

    mapping(address => address) internal cTokens; //cTokens;

    event NewMappingcToken(
        address indexed token,
        address indexed mappingcToken
    );
    event NewdTokenAddresses(address indexed originaldToken, address indexed newdToken);
    event DisableToken(address indexed underlyingToken);
    event EnableToken(address indexed underlyingToken);

    constructor(address _dTokens) public {
        initialize(_dTokens);
    }

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize(address _dTokens) public {
        require(!initialized, "initialize: Already initialized!");
        owner = msg.sender;
        dTokens = _dTokens;
        notEntered = true;
        BASE = 1e18;
        initialized = true;
    }

    /**
     * @dev Update dToken mapping contract.
     * @param _newdTokens The new dToken mapping contact.
     */
    function setdTokens(address _newdTokens) external auth {
        require(_newdTokens != dTokens, "setdTokens: The same dToken address!");
        address _originaldTokens = dTokens;
        dTokens = _newdTokens;
        emit NewdTokenAddresses(_originaldTokens, _newdTokens);
    }

    /**
     * @dev Authorized function to disable an underlying token.
     * @param _underlyingToken Token to disable.
     */
    function disableToken(address _underlyingToken) external auth {
        require(tokensEnable[_underlyingToken], "disableToken: Has been disabled!");
        tokensEnable[_underlyingToken] = false;
        emit DisableToken(_underlyingToken);
    }

    /**
     * @dev Authorized function to enable an underlying token.
     * @param _underlyingToken Token to enable.
     */
    function enableToken(address _underlyingToken) external auth {
        require(!tokensEnable[_underlyingToken], "enableToken: Has been enabled!");
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

    /**
     * @dev This token `_underlyingToken` approves to market and dToken contract.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken) external {
        address _cToken = cTokens[_underlyingToken];
        address _dToken = dTokenAddresses(dTokens).getdToken(_underlyingToken);

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
     * @return True is success, false is failure.
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

        uint256 _previousBalance = getRealBalance(_underlyingToken);


            InterestsDetails storage currentInterests
         = interestsDetails[_underlyingToken];

        uint256 _periodInterests = _previousBalance.sub(
            currentInterests.underlyingBalance
        );

        require(
            ICompound(_cToken).mint(_amount) == 0,
            "supply: Fail to supply to compound!"
        );
        uint256 _currentBalance = getRealBalance(_underlyingToken);

        uint256 _changedAmount = _currentBalance.sub(_previousBalance);

        currentInterests.interests = currentInterests.interests.add(
            _periodInterests
        );
        currentInterests.underlyingBalance = _currentBalance;

        return _changedAmount;
    }

    /**
     * @dev Withdraw token from market, but only for dToken contract.
     * @param _underlyingToken Token to withdraw.
     * @param _amount Token amount to withdraw.
     * @return Actually withdraw token amount.
     */
    function withdraw(address _underlyingToken, uint256 _amount)
        external
        whenNotPaused
        auth
        nonReentrant
        returns (uint256)
    {
        address _cToken = cTokens[_underlyingToken];
        require(_cToken != address(0x0), "redeem: Do not support token!");

        require(_amount > 0, "redeem: Redeem amount should be greater than 0!");

        uint256 _lastBalance = getRealBalance(_underlyingToken);


            InterestsDetails storage currentInterests
         = interestsDetails[_underlyingToken];
        uint256 _periodInterests = _lastBalance.sub(
            currentInterests.underlyingBalance
        );

        uint256 _previousBalance = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        if (_amount == uint256(-1)) {
            uint256 cTokenBalance = ICompound(_cToken).balanceOf(address(this));
            require(
                ICompound(_cToken).redeem(cTokenBalance) == 0,
                "withdraw: Fail to withdraw from market!"
            );
        } else {
            require(
                ICompound(_cToken).redeemUnderlying(_amount) == 0,
                "withdraw: Fail to withdraw from market!"
            );
        }
        uint256 _currentBalance = IERC20(_underlyingToken).balanceOf(
            address(this)
        );

        uint256 _changedAmount = _currentBalance.sub(_previousBalance);

        currentInterests.interests = currentInterests.interests.add(
            _periodInterests
        );
        currentInterests.underlyingBalance = getRealBalance(_underlyingToken);

        return _changedAmount;
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
        uint256 cTokenBalance;
        uint256 exchangeRate;
        uint256 error;
        (error, cTokenBalance, , exchangeRate) = ICompound(_cToken)
            .getAccountSnapshot(address(this));
        if (error != 0) {
            return 0;
        }

        return cTokenBalance.mul(exchangeRate) / BASE;
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
        address _cToken = cTokens[_underlyingToken];
        uint256 _underlyingBalance = getBalance(_underlyingToken);
        if (_underlyingBalance == 0) {
            return 0;
        }

        uint256 _cash = IERC20(_underlyingToken).balanceOf(_cToken);

        if (_underlyingBalance > _cash) {
            return _cash;
        }

        return _underlyingBalance;
    }

    /**
     * @dev Update exchange rate in cToken
     *      and excludes fee, if has.
     * @param _underlyingToken Token to get actual balance.
     */
    function getRealBalance(address _underlyingToken) public returns (uint256) {
        address _cToken = cTokens[_underlyingToken];

        return ICompound(_cToken).balanceOfUnderlying(address(this));
    }

    function getcToken(address _underlyingToken)
        external
        view
        returns (address)
    {
        return cTokens[_underlyingToken];
    }
}
