pragma solidity 0.5.12;

import "./dTokenAddresses.sol";
import "./helpers/ReentrancyGuard.sol";
import "./library/ERC20SafeTransfer.sol";
import "./library/Pausable.sol";
import "./library/SafeMath.sol";

contract InternalHandler is ERC20SafeTransfer, ReentrancyGuard, Pausable {
    using SafeMath for uint256;
    bool private initialized; // Flags for initializing data
    address public dTokens; // dToken mapping contract

    mapping(address => bool) public tokensEnable; // Supports token or not

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
        initialized = true;
    }

    /**
     * @dev Update dToken mapping contract.
     * @param _newdTokens The new dToken mapping contact.
     */
    function setdTokens(address _newdTokens) external auth {
        dTokens = _newdTokens;
    }

    /**
     * @dev Authorized function to disable an underlying token.
     * @param _underlyingToken Token to disable.
     */
    function disableToken(address _underlyingToken) external auth {
        tokensEnable[_underlyingToken] = false;
    }

    /**
     * @dev Authorized function to enable an underlying token.
     * @param _underlyingToken Token to enable.
     */
    function enableToken(address _underlyingToken) external auth {
        tokensEnable[_underlyingToken] = true;
    }

    /**
     * @dev This contract approves to `_dToken` contract with `_underlyingToken`.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken) public auth {
        address _dToken = dTokenAddresses(dTokens).getdToken(_underlyingToken);
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
        require(tokensEnable[_underlyingToken], "deposit: token is disabled!");
        return _amount;
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
        // TODO: fail or not?
        if (
            _amount == 0 ||
            IERC20(_underlyingToken).balanceOf(address(this)) < _amount
        ) return 0;
        return _amount;
    }

    /**
     * @dev Redeem token from market, but only for dToken contract.
     * @param _underlyingToken Token to redeem.
     * @param _amount Token amount to redeem.
     * @return Actually redeem token amount.
     */
    function redeem(address _underlyingToken, uint256 _amount)
        external
        whenNotPaused
        auth
        nonReentrant
        returns (uint256, uint256)
    {
        if (
            _amount == 0 ||
            IERC20(_underlyingToken).balanceOf(address(this)) < _amount
        ) return (0, 0);
        return (_amount, _amount);
    }

    /**
     * @dev Total balance with any accumulated interest for `_underlyingToken` belonging to `handler`
     * @param _underlyingToken Token to get balance.
     */
    function getBalance(address _underlyingToken)
        public
        view
        returns (uint256)
    {
        return IERC20(_underlyingToken).balanceOf(address(this));
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
        return getBalance(_underlyingToken);
    }

    /**
     * @dev The maximum withdrawable amount of asset `_underlyingToken` in the market,
     *      and excludes fee, if has.
     * @param _underlyingToken Token to get actual balance.
     */
    function getRealBalance(address _underlyingToken)
        external
        view
        returns (uint256)
    {
        return getLiquidity(_underlyingToken);
    }

    /**
     * @dev Calculate the actual amount of token that has excluded exchange fee
     *      between token and wrapped token, if has.
     * @param _pie Token amount to get.
     */
    function getRealAmount(uint256 _pie) external view returns (uint256) {
        return _pie;
    }

    /**
     * @dev Get token `_underlyingToken` APR of the market.
     * @param _underlyingToken Token to get APR.
     */
    function getInterestRate(address _underlyingToken)
        external
        view
        returns (uint256)
    {
        _underlyingToken;
        return 0;
    }
}
