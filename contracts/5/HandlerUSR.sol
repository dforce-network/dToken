pragma solidity 0.5.12;

import "./interface/ILendFMe.sol";
import "./interface/WrappedToken.sol";
import "./library/DSAuth.sol";
import "./library/ERC20SafeTransfer.sol";
import "./library/SafeMath.sol";

contract HandlerUSR is DSAuth, ERC20SafeTransfer {
    using SafeMath for uint256;

    address public targetAddr; // market address
    address public dToken; // dToken address
    address public wrappedToken; // wrapped token address

    uint256 constant ONE = 10**27;
    uint256 constant BASE = 10**18;

    /**
     * @dev Throws if called by any account other than the dToken.
     */
    modifier onlyDToken() {
        require(msg.sender == dToken, "non-dToken");
        _;
    }

    constructor(
        address _targetAddr,
        address _dToken,
        address _wrappedToken
    ) public {
        targetAddr = _targetAddr;
        dToken = _dToken;
        wrappedToken = _wrappedToken;
        require(
            doApprove(_wrappedToken, _targetAddr, uint256(-1)),
            "constructor: handler contract approve target failed."
        );
    }

    function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(y) / ONE;
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(ONE) / y;
    }

    function rdivup(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(ONE).add(y.sub(1)) / y;
    }

    function mulScale(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(y) / BASE;
    }

    function divScale(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(BASE).add(y.sub(1)) / y;
    }

    /**
     * @dev Exchange token to wrapped token, then supply wrapped token to market, but only for owenr.
     * @param _token Token address to supply.
     */
    function supply(address _token) external auth {
        uint256 _pie = IERC20(_token).balanceOf(address(this));
        require(_pie > 0, "supply: token amount should be greater than 0");

        address _wrappedToken = wrappedToken;
        WrappedToken(_wrappedToken).mint(address(this), _pie);

        uint256 _wad = IERC20(_wrappedToken).balanceOf(address(this));
        require(
            _wad > 0,
            "supply: wrapped token amount should be greater than 0"
        );
        require(
            ILendFMe(targetAddr).supply(address(_wrappedToken), _wad) == 0,
            "supply: fail to supply to market"
        );
    }

    /**
     * @dev Withdraw wrapped token from market, then exchange wrapped token to token, but only for owenr.
     * @param _token Token address to withdraw.
     * @param _recipient Account address to receive token.
     * @param _pie Token amount to withdraw.
     */
    function withdraw(
        address _token,
        address _recipient,
        uint256 _pie
    ) external auth {
        require(_pie > 0, "withdraw: token amount should be greater than 0");

        address _wrappedToken = wrappedToken;
        // Calculate the amount of wrapped token according to the amount of token.
        uint256 totalAmountWithFee = divScale(
            _pie,
            BASE.sub(WrappedToken(_wrappedToken).originationFee())
        );
        uint256 _wad = rdivup(
            totalAmountWithFee,
            WrappedToken(_wrappedToken).getExchangeRate()
        );
        require(
            _wad > 0,
            "withdraw: wrapped token amount should be greater than 0"
        );
        require(
            ILendFMe(targetAddr).withdraw(address(_wrappedToken), _wad) == 0,
            "withdraw: fail to withdraw from market"
        );

        WrappedToken(_wrappedToken).redeem(address(this), _pie);
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        require(
            _balance > 0 && _balance == _pie,
            "withdraw: wrapped token amount should be greater than 0"
        );
        require(
            doTransferOut(_token, _recipient, _pie),
            "withdraw: Token transfer out of contract failed."
        );
    }

    /**
     * @dev Transfer out token, but only for owenr.
     * @param _token Token address to transfer out.
     * @param _recipient Account address to receive token.
     * @param _amount Token amount to transfer out.
     */
    function takeOut(
        address _token,
        address _recipient,
        uint256 _amount
    ) external auth {
        require(
            doTransferOut(_token, _recipient, _amount),
            "takeOut: Token transfer out of contract failed."
        );
    }

    /**
     * @dev Transfer out wrapped token, but only for owenr.
     * @param _recipient Account address to receive token.
     * @param _amount Wrapped token amount to transfer out.
     */
    function takeOut(address _recipient, uint256 _amount) external auth {
        require(
            doTransferOut(wrappedToken, _recipient, _amount),
            "takeOut: Token transfer out of contract failed."
        );
    }

    /**
     * @dev Wrapped token approves to market and original token `token` approves to dToken contract.
     * @param _token Token address to approve.
     */
    function approve(address _token) public {
        if (
            IERC20(_token).allowance(address(this), wrappedToken) != uint256(-1)
        )
            require(
                doApprove(_token, wrappedToken, uint256(-1)),
                "approve: Handler contract approve target failed."
            );

        if (IERC20(_token).allowance(address(this), dToken) != uint256(-1))
            require(
                doApprove(_token, dToken, uint256(-1)),
                "approve: Handler contract approve dToken failed."
            );
    }

    /**
     * @dev Exchange token to wrapped token, then supply wrapped token to market, but only for dToken contract.
     * @param _token Token to deposit.
     * @return True is success, false is failure.
     */
    function deposit(address _token) external onlyDToken returns (bool) {
        uint256 _pie = IERC20(_token).balanceOf(address(this));
        if (_pie == 0) return false;

        address _wrappedToken = wrappedToken;
        // Exchange token to wrapped token.
        WrappedToken(_wrappedToken).mint(address(this), _pie);

        uint256 _wad = IERC20(_wrappedToken).balanceOf(address(this));
        if (
            _wad == 0 ||
            ILendFMe(targetAddr).supply(address(_wrappedToken), _wad) != 0
        ) return false;

        return true;
    }

    /**
     * @dev Withdraw wrapped token from market, exchange it to token, but only for dToken contract.
     * @param _token Token to withdraw.
     * @param _pie Token amount to withdraw.
     */
    function withdraw(address _token, uint256 _pie)
        external
        onlyDToken
        returns (uint256)
    {
        if (_pie == 0) return 0;

        address _wrappedToken = wrappedToken;

        uint256 _wad = rdivup(
            _pie,
            WrappedToken(_wrappedToken).getExchangeRate()
        );

        if (ILendFMe(targetAddr).withdraw(address(_wrappedToken), _wad) != 0)
            return 0;

        // Exchange wrapped token to token.
        WrappedToken(_wrappedToken).burn(address(this), _wad);
        uint256 _balance = IERC20(_token).balanceOf(address(this));

        // Under normal case: _balance <= _pie, check the amount of token in the `Handler`,
        // remaining token should be 0.
        if (_balance > _pie) return 0;

        return _balance;
    }

    /**
     * @dev Redeem wrapped token from market, exchange it to token, but only for dToken contract.
     * @param _token Token to redeem.
     * @param _pie Token amount to redeem.
     */
    function redeem(address _token, uint256 _pie)
        external
        onlyDToken
        returns (uint256, uint256)
    {
        if (_pie == 0) return (0, 0);

        address _wrappedToken = wrappedToken;
        // Plus the exchange fee, calculate how many wrapped tokens are needed to exchange original tokens.
        uint256 _totalAmountWithFee = divScale(
            _pie,
            BASE.sub(WrappedToken(_wrappedToken).originationFee())
        );
        // According to exchange rate, get the amount of wrapped token.
        uint256 _wad = rdivup(
            _totalAmountWithFee,
            WrappedToken(_wrappedToken).getExchangeRate()
        );
        // Withdraw wrapped token from market.
        if (ILendFMe(targetAddr).withdraw(address(_wrappedToken), _wad) != 0)
            return (0, 0);

        // Exchange wrapped token to token.
        WrappedToken(_wrappedToken).redeem(address(this), _pie);

        uint256 _balance = IERC20(_token).balanceOf(address(this));
        if (_balance == 0 || _balance != _pie) return (0, 0);

        return (_totalAmountWithFee, _balance);
    }

    /**
     * @dev Supply balance with any accumulated interest for `_token` belonging to `HandlerUSR`,
     *      including fee in wrapped token.
     * @param _token Token address to get balance.
     */
    function getBalance(address _token) public view returns (uint256) {
        address _wrappedToken = wrappedToken;
        uint256 _wad = ILendFMe(targetAddr).getSupplyBalance(
            address(this),
            _wrappedToken
        );

        return rmul(_wad, WrappedToken(_wrappedToken).getExchangeRate());
    }

    /**
     * @dev The maximum withdrawable amount of asset `_token` in the market, including fee in wrapped token.
     * @param _token Token address to get balance.
     */
    function getLiquidity(address _token) public view returns (uint256) {
        address _targetAddr = targetAddr;
        address _wrappedToken = wrappedToken;
        uint256 _wad = ILendFMe(_targetAddr).getSupplyBalance(
            address(this),
            _wrappedToken
        );
        uint256 _balance = IERC20(_wrappedToken).balanceOf(_targetAddr);
        if (_wad > _balance) _wad = _balance;

        return rmul(_wad, WrappedToken(_wrappedToken).getExchangeRate());
    }

    /**
     * @dev The maximum withdrawable amount of asset `_token` in the market,
     *      and excludes fee in wrapped token.
     * @param _token Token address to get actual balance.
     */
    function getRealBalance(address _token) external view returns (uint256) {
        address _wrappedToken = wrappedToken;
        uint256 _wad = getLiquidity(_wrappedToken);

        // fianl token amount = wrapped token * exchange rate * (1 - fee)
        uint256 totalTokenAmountWithFee = rmul(
            _wad,
            WrappedToken(_wrappedToken).getExchangeRate()
        );
        return
            mulScale(
                totalTokenAmountWithFee,
                BASE.sub(WrappedToken(_wrappedToken).originationFee())
            );
    }

    /**
     * @dev Calculate the actual amount of token that has excluded exchange fee
     *      between token and wrapped token, if has.
     * @param _pie Token amount to get.
     */
    function getRealAmount(uint256 _pie) external view returns (uint256) {
        return
            mulScale(
                _pie,
                BASE.sub(WrappedToken(wrappedToken).originationFee())
            );
    }

    /**
     * @dev Get token `_token` APR in the market.
     * @param _token Token address to get APR.
     */
    function getInterestRate(address _token) external view returns (uint256) {
        // Wrapped token APR in the market
        (, , , , uint256 _apr, , , , ) = ILendFMe(targetAddr).markets(
            wrappedToken
        );
        // Accumulate the annual interest rate of token in wrapped token, scaled by 1e18.
        return
            _apr
                .mul(2102400)
                .add(
                rmul(
                    WrappedToken(wrappedToken).getFixedInterestRate(31536000),
                    BASE
                )
            )
                .sub(BASE);
    }

    function getTargetAddress() external view returns (address) {
        return targetAddr;
    }

    function getDToken() external view returns (address) {
        return dToken;
    }
}
