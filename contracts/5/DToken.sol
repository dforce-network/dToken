pragma solidity 0.5.12;

import "./helpers/ReentrancyGuard.sol";
import "./library/Pausable.sol";
import "./library/ERC20SafeTransfer.sol";
import "./library/SafeMath.sol";
import "./interface/IDispatcher.sol";
import "./interface/IHandler.sol";

contract DToken is ReentrancyGuard, Pausable, ERC20SafeTransfer {
    using SafeMath for uint256;
    // --- Data ---
    bool private initialized; // Flag of initialize data

    struct DTokenData {
        uint256 exchangeRate;
        uint256 totalInterest;
    }

    DTokenData public data;

    address public feeRecipient;
    mapping(bytes4 => uint256) public originationFee; // Trade fee

    address public dispatcher;
    address public token;

    uint256 constant BASE = 10**18;

    // --- ERC20 Data ---
    string public name;
    string public symbol;
    uint256 public decimals;
    uint256 public totalSupply;

    struct Balance {
        uint256 value;
        uint256 exchangeRate;
        uint256 interest;
    }
    mapping(address => Balance) public balances;
    mapping(address => mapping(address => uint256)) public allowance;

    // --- Event ---
    event Approval(address indexed src, address indexed guy, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);

    event Interest(
        address indexed src,
        uint256 interest,
        uint256 increase,
        uint256 totalInterest
    );
    event Mint(
        address account,
        uint256 pie,
        uint256 wad,
        uint256 totalSupply,
        uint256 exchangeRate
    );
    event Burn(
        address account,
        uint256 pie,
        uint256 wad,
        uint256 totalSupply,
        uint256 exchangeRate
    );
    event Rebalance(
        address admin,
        address[] withdraw,
        uint256[] withdrawAmount,
        address[] supply,
        uint256[] supplyAmount
    );
    event TransferFee(
        address admin,
        address token,
        address feeRecipient,
        uint256 amount
    );

    event FeeRecipientSet(
        address indexed oldFeeRecipient,
        address indexed newFeeRecipient
    );
    event NewDispatcher(address Dispatcher, address oldDispatcher);
    event NewOriginationFee(
        bytes4 sig,
        uint256 oldOriginationFeeMantissa,
        uint256 newOriginationFeeMantissa
    );

    /**
     * The constructor is used here to ensure that the implementation
     * contract is initialized. An uncontrolled implementation
     * contract might lead to misleading state
     * for users who accidentally interact with it.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _token,
        address _dispatcher
    ) public {
        initialize(_name, _symbol, _token, _dispatcher);
    }

    // --- Init ---
    function initialize(
        string memory _name,
        string memory _symbol,
        address _token,
        address _dispatcher
    ) public {
        require(!initialized, "initialize: already initialized.");
        owner = msg.sender;
        feeRecipient = address(this);
        name = _name;
        symbol = _symbol;
        token = _token;
        dispatcher = _dispatcher;
        decimals = IERC20(_token).decimals();
        data.exchangeRate = BASE;
        notEntered = true;
        initialized = true;

        emit NewDispatcher(_dispatcher, address(0));
    }

    /**
     * @dev Sets a new fee recipient address.
     * @param _newFeeRecipient The address allowed to collect fees.
     */
    function setFeeRecipient(address _newFeeRecipient) external auth {
        require(
            _newFeeRecipient != address(0),
            "cannot set fee recipient to address zero"
        );
        address _oldFeeRecipient = feeRecipient;
        feeRecipient = _newFeeRecipient;
        emit FeeRecipientSet(_oldFeeRecipient, feeRecipient);
    }

    /**
     * @dev Manager function to set a new dispatcher contract address.
     * @param _newDispatcher New dispatcher contract address.
     * @return bool true=success, otherwise a failure.
     */
    function updateDispatcher(address _newDispatcher) external auth {
        address _oldDispatcher = dispatcher;
        require(
            _newDispatcher != _oldDispatcher,
            "updateDispatcher: same dispatcher address."
        );
        dispatcher = _newDispatcher;
        emit NewDispatcher(_newDispatcher, _oldDispatcher);
    }

    /**
     * @dev Manager function to set a new origination fee.
     * @param _sig function msg.sig.
     * @param _newOriginationFee New trading fee ratio, scaled by 1e18.
     * @return bool true=success, otherwise a failure.
     */
    function updateOriginationFee(bytes4 _sig, uint256 _newOriginationFee)
        external
        auth
    {
        require(
            _newOriginationFee < BASE / 10,
            "updateOriginationFee: fee should be less than ten percent."
        );
        uint256 _oldOriginationFee = originationFee[_sig];
        require(
            _oldOriginationFee != _newOriginationFee,
            "updateOriginationFee: same fee."
        );
        originationFee[_sig] = _newOriginationFee;
        emit NewOriginationFee(_sig, _oldOriginationFee, _newOriginationFee);
    }

    /**
     * @dev Owner function to transfer token out to avoid user makes a wrong operation.
     * @param _token Reserve asset.
     * @param _amount Amount to transfer.
     */
    function transferFee(address _token, uint256 _amount) external auth {
        require(
            feeRecipient != address(this),
            "transferFee: Token transfer out of contract failed."
        );
        require(
            doTransferOut(_token, feeRecipient, _amount),
            "transferFee: Token transfer out of contract failed."
        );
        emit TransferFee(msg.sender, _token, feeRecipient, _amount);
    }

    /**
     * @dev Authorized function to rebalance the assets of the whole system.
     * @param _withdraw From which market to get assets.
     * @param _withdrawAmount Amount to withdraw form markets.
     * @param _supply Markets that deposits assets.
     * @param _supplyAmount Amount that deposits to markets.
     */
    function rebalance(
        address[] calldata _withdraw,
        uint256[] calldata _withdrawAmount,
        address[] calldata _supply,
        uint256[] calldata _supplyAmount
    ) external auth {
        require(
            _withdraw.length == _withdrawAmount.length &&
                _supply.length == _supplyAmount.length,
            "rebalance: array parameters mismatch"
        );
        address _token = token;
        address _defaultHandler = IDispatcher(dispatcher).defaultHandler();
        uint256[] memory _withdrawAmountResult = new uint256[](
            _withdrawAmount.length
        );
        for (uint256 i = 0; i < _withdraw.length; i++) {
            _withdrawAmountResult[i] = _withdrawAmount[i] == uint256(-1)
                ? IHandler(_withdraw[i]).getRealBalance(_token)
                : _withdrawAmount[i];
            if (_withdrawAmount[i] == 0 || _defaultHandler == _withdraw[i])
                continue;

            require(
                IHandler(_withdraw[i]).withdraw(_token, _withdrawAmount[i]) ==
                    _withdrawAmountResult[i],
                "rebalance: "
            );
            require(
                doTransferFrom(
                    _token,
                    _withdraw[i],
                    _defaultHandler,
                    _withdrawAmount[i]
                ),
                "rebalance: transfer to user failed"
            );
        }

        for (uint256 i = 0; i < _supply.length; i++) {
            require(
                IDispatcher(dispatcher).handlerActive(_supply[i]) &&
                    IHandler(_supply[i]).tokensEnable(_token),
                "rebalance: "
            );
            if (_supplyAmount[i] == 0 || _defaultHandler == _supply[i])
                continue;

            require(
                doTransferFrom(
                    _token,
                    _defaultHandler,
                    _supply[i],
                    _supplyAmount[i]
                ),
                "rebalance: transfer out to user failed"
            );
            require(
                IHandler(_supply[i]).deposit(_token, _supplyAmount[i]) ==
                    _supplyAmount[i],
                "rebalance: "
            );
        }
        emit Rebalance(
            msg.sender,
            _withdraw,
            _withdrawAmountResult,
            _supply,
            _supplyAmount
        );
    }

    function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(y) / BASE;
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(BASE) / y;
    }

    function rdivup(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(BASE).add(y.sub(1)) / y;
    }

    /**
     * @dev Current newest exchange rate, scaled by 1e18.
     */
    function getCurrentExchangeRate() internal returns (uint256) {
        address[] memory _handlers = getHandler();
        return getCurrentExchangeRateByHandler(_handlers, token);
    }

    /**
     * @dev According to `_handlers` and token amount `_token` to calculate the exchange rate.
     * @param _handlers The list of `_handlers`.
     * @param _token Token address.
     * @return Current exchange rate between token and dToken.
     */
    function getCurrentExchangeRateByHandler(
        address[] memory _handlers,
        address _token
    ) internal returns (uint256) {
        uint256 _totalToken = 0;
        for (uint256 i = 0; i < _handlers.length; i++)
            _totalToken = _totalToken.add(
                IHandler(_handlers[i]).getRealBalance(_token)
            );

        return
            totalSupply == 0 || _totalToken == 0
                ? data.exchangeRate
                : rdiv(_totalToken, totalSupply);
    }

    function updateInterest(address _account, uint256 _exchangeRate) internal {
        Balance storage _balance = balances[_account];
        if (
            _balance.exchangeRate > 0 && _exchangeRate > _balance.exchangeRate
        ) {
            uint256 _interestIncrease = rmul(
                _exchangeRate.sub(_balance.exchangeRate),
                _balance.value
            );
            _balance.interest = _balance.interest.add(_interestIncrease);
            data.totalInterest = data.totalInterest.add(_interestIncrease);
            emit Interest(
                _account,
                _balance.interest,
                _interestIncrease,
                data.totalInterest
            );
        }
        _balance.exchangeRate = _exchangeRate;
        data.exchangeRate = _exchangeRate;
    }

    struct MintLocalVars {
        address token;
        address[] handlers;
        uint256[] amounts;
        uint256 exchangeRate;
        uint256 originationFee;
        uint256 fee;
        uint256 mintAmount;
        uint256 wad;
        uint256 interestIncrease;
    }

    /**
     * @dev Deposit token to earn savings, but only when the contract is not paused.
     * @param _dst Account who will get savings.
     * @param _pie Amount to deposit, scaled by 1e18.
     */
    function mint(address _dst, uint256 _pie)
        public
        nonReentrant
        whenNotPaused
    {
        MintLocalVars memory _mintLocal;
        _mintLocal.token = token;

        _mintLocal.originationFee = originationFee[msg.sig];
        _mintLocal.fee = rmul(_pie, _mintLocal.originationFee);
        if (_mintLocal.fee > 0)
            require(
                doTransferFrom(
                    _mintLocal.token,
                    msg.sender,
                    feeRecipient,
                    _mintLocal.fee
                ),
                "mint: transferFrom fee failed"
            );

        // Get deposit strategy base on the deposit amount `_pie`.
        (_mintLocal.handlers, _mintLocal.amounts) = IDispatcher(dispatcher)
            .getDepositStrategy(_pie.sub(_mintLocal.fee));
        require(_mintLocal.handlers.length > 0, "mint:");

        // Get current exchange rate.
        _mintLocal.exchangeRate = getCurrentExchangeRateByHandler(
            _mintLocal.handlers,
            _mintLocal.token
        );

        for (uint256 i = 0; i < _mintLocal.handlers.length; i++) {
            // If deposit amount is 0 by this handler, then pass.
            if (_mintLocal.amounts[i] == 0) continue;

            // Transfer the calculated token amount from `msg.sender` to the `handler`.
            require(
                doTransferFrom(
                    _mintLocal.token,
                    msg.sender,
                    _mintLocal.handlers[i],
                    _mintLocal.amounts[i]
                ),
                "mint: transferFrom token failed."
            );
            // The `handler` deposit obtained token to corresponding market to earn savings.
            _mintLocal.mintAmount = _mintLocal.mintAmount.add(
                IHandler(_mintLocal.handlers[i]).deposit(
                    _mintLocal.token,
                    _mintLocal.amounts[i]
                )
            );
        }

        // Calculate amount of the dToken based on current exchange rate.
        _mintLocal.wad = rdiv(_mintLocal.mintAmount, _mintLocal.exchangeRate);
        require(_mintLocal.wad > 0, "mint:");

        updateInterest(_dst, _mintLocal.exchangeRate);

        Balance storage _balance = balances[_dst];
        _balance.value = _balance.value.add(_mintLocal.wad);
        totalSupply = totalSupply.add(_mintLocal.wad);

        emit Transfer(address(0), _dst, _mintLocal.wad);
        emit Mint(
            _dst,
            _pie,
            _mintLocal.wad,
            totalSupply,
            _mintLocal.exchangeRate
        );
    }

    struct BurnLocalVars {
        address token;
        address[] handlers;
        uint256[] amounts;
        uint256 exchangeRate;
        uint256 withdrawAmount;
        uint256 withdrawTotalAmount;
        uint256 userAmount;
        uint256 fee;
        uint256 wad;
        uint256 originationFee;
        uint256 interestIncrease;
    }

    /**
     * @dev Withdraw to get token according to input dToken amount,
     *      but only when the contract is not paused.
     * @param _src Account who will spend dToken.
     * @param _wad Amount to burn dToken, scaled by 1e18.
     */
    function burn(address _src, uint256 _wad)
        public
        nonReentrant
        whenNotPaused
    {
        BurnLocalVars memory _burnLocal;

        _burnLocal.token = token;
        // Get current exchange rate.
        _burnLocal.exchangeRate = getCurrentExchangeRateByHandler(
            _burnLocal.handlers,
            _burnLocal.token
        );

        // Get `_token` best withdraw strategy base on the withdraw amount `_pie`.
        (_burnLocal.handlers, _burnLocal.amounts) = IDispatcher(dispatcher)
            .getWithdrawStrategy(
            _burnLocal.token,
            rmul(_wad, _burnLocal.exchangeRate)
        );
        require(_burnLocal.handlers.length > 0, "burn:");

        _burnLocal.originationFee = originationFee[msg.sig];
        for (uint256 i = 0; i < _burnLocal.handlers.length; i++) {
            if (_burnLocal.amounts[i] == 0) continue;

            // The `handler` withdraw calculated amount from the market.
            _burnLocal.withdrawAmount = IHandler(_burnLocal.handlers[i])
                .withdraw(_burnLocal.token, _burnLocal.amounts[i]);
            require(
                _burnLocal.withdrawAmount > 0,
                "burn: handler withdraw failed"
            );

            _burnLocal.fee = rmul(
                _burnLocal.withdrawAmount,
                _burnLocal.originationFee
            );
            // Transfer the token trade fee from the `handler` to the `dToken`.
            if (_burnLocal.fee > 0)
                require(
                    doTransferFrom(
                        _burnLocal.token,
                        _burnLocal.handlers[i],
                        feeRecipient,
                        _burnLocal.fee
                    ),
                    "burn: transfer fee failed"
                );

            // // After subtracting the fee, the user finally can get quantity.
            _burnLocal.userAmount = _burnLocal.withdrawAmount.sub(
                _burnLocal.fee
            );
            // Transfer the calculated token amount from the `handler` to the receiver `_src`.
            if (_burnLocal.userAmount > 0)
                require(
                    doTransferFrom(
                        _burnLocal.token,
                        _burnLocal.handlers[i],
                        msg.sender,
                        _burnLocal.userAmount
                    ),
                    "burn: transfer to user failed"
                );
            _burnLocal.withdrawTotalAmount = _burnLocal.withdrawTotalAmount.add(
                _burnLocal.withdrawAmount
            );
        }

        updateInterest(_src, _burnLocal.exchangeRate);

        Balance storage _balance = balances[_src];
        require(_balance.value >= _wad, "burn: insufficient balance");
        if (_src != msg.sender && allowance[_src][msg.sender] != uint256(-1)) {
            require(
                allowance[_src][msg.sender] >= _wad,
                "burn: insufficient allowance"
            );
            allowance[_src][msg.sender] = allowance[_src][msg.sender].sub(_wad);
        }
        _balance.value = _balance.value.sub(_wad);
        totalSupply = totalSupply.sub(_wad);

        emit Transfer(_src, address(0), _wad);
        emit Burn(
            _src,
            _burnLocal.withdrawTotalAmount,
            _wad,
            totalSupply,
            _burnLocal.exchangeRate
        );
    }

    struct RedeemLocalVars {
        address token;
        address[] handlers;
        uint256[] amounts;
        uint256 exchangeRate;
        uint256 redeemAmount;
        uint256 redeemTotalAmount;
        uint256 userAmount;
        uint256 fee;
        uint256 wad;
        uint256 originationFee;
        uint256 interestIncrease;
    }

    /**
     * @dev Withdraw to get specified token, but only when the contract is not paused.
     * @param _src Account who will spend dToken.
     * @param _pie Amount to withdraw token, scaled by 1e18.
     */
    function redeem(address _src, uint256 _pie)
        public
        nonReentrant
        whenNotPaused
    {
        RedeemLocalVars memory _redeemLocal;

        _redeemLocal.token = token;
        _redeemLocal.originationFee = originationFee[0x9dc29fac];

        // Get `_token` best redeem strategy base on the redeem amount including fee.
        (_redeemLocal.handlers, _redeemLocal.amounts) = IDispatcher(dispatcher)
            .getWithdrawStrategy(
            _redeemLocal.token,
            rdivup(_pie, BASE.sub(_redeemLocal.originationFee))
        );
        require(_redeemLocal.handlers.length > 0, "redeem:");

        // Get current exchange rate.
        _redeemLocal.exchangeRate = getCurrentExchangeRateByHandler(
            _redeemLocal.handlers,
            _redeemLocal.token
        );
        for (uint256 i = 0; i < _redeemLocal.handlers.length; i++) {
            if (_redeemLocal.amounts[i] == 0) continue;

            // The `handler` redeem calculated amount from the market.
            _redeemLocal.redeemAmount = IHandler(_redeemLocal.handlers[i])
                .withdraw(_redeemLocal.token, _redeemLocal.amounts[i]);
            require(_redeemLocal.redeemAmount > 0, "redeem: ");

            // The calculated amount contains exchange token fee, if it exists.
            _redeemLocal.fee = rmul(
                _redeemLocal.redeemAmount,
                _redeemLocal.originationFee
            );
            // Transfer the token trade fee from the `handler` to the `dToken`.
            if (_redeemLocal.fee > 0)
                require(
                    doTransferFrom(
                        _redeemLocal.token,
                        _redeemLocal.handlers[i],
                        feeRecipient,
                        _redeemLocal.fee
                    ),
                    "redeem: transfer fee failed"
                );

            // After subtracting the fee, the user finally can get quantity.
            _redeemLocal.userAmount = _redeemLocal.redeemAmount.sub(
                _redeemLocal.fee
            );
            // Transfer the calculated token amount from the `handler` to the receiver `_src`
            if (_redeemLocal.userAmount > 0)
                require(
                    doTransferFrom(
                        _redeemLocal.token,
                        _redeemLocal.handlers[i],
                        msg.sender,
                        _redeemLocal.userAmount
                    ),
                    "redeem: transfer to user failed"
                );
            _redeemLocal.redeemTotalAmount = _redeemLocal.redeemTotalAmount.add(
                _redeemLocal.redeemAmount
            );
        }

        // Calculate amount of the dToken based on current exchange rate.
        _redeemLocal.wad = rdivup(
            _redeemLocal.redeemTotalAmount,
            _redeemLocal.exchangeRate
        );

        updateInterest(_src, _redeemLocal.exchangeRate);

        Balance storage _balance = balances[_src];
        require(
            _balance.value >= _redeemLocal.wad,
            "redeem: insufficient balance"
        );
        if (_src != msg.sender && allowance[_src][msg.sender] != uint256(-1)) {
            require(
                allowance[_src][msg.sender] >= _redeemLocal.wad,
                "redeem: insufficient allowance"
            );
            allowance[_src][msg.sender] = allowance[_src][msg.sender].sub(
                _redeemLocal.wad
            );
        }
        _balance.value = _balance.value.sub(_redeemLocal.wad);
        totalSupply = totalSupply.sub(_redeemLocal.wad);

        emit Transfer(_src, address(0), _redeemLocal.wad);
        emit Burn(
            _src,
            _redeemLocal.redeemTotalAmount,
            _redeemLocal.wad,
            totalSupply,
            _redeemLocal.exchangeRate
        );
    }

    // --- Token ---
    function transfer(address _dst, uint256 _wad) external returns (bool) {
        return transferFrom(msg.sender, _dst, _wad);
    }

    function transferFrom(
        address _src,
        address _dst,
        uint256 _wad
    ) public nonReentrant whenNotPaused returns (bool) {
        Balance storage _srcBalance = balances[_src];
        require(
            _srcBalance.value >= _wad,
            "transferFrom: insufficient balance"
        );
        if (_src != msg.sender && allowance[_src][msg.sender] != uint256(-1)) {
            require(
                allowance[_src][msg.sender] >= _wad,
                "transferFrom: insufficient allowance"
            );
            allowance[_src][msg.sender] = allowance[_src][msg.sender].sub(_wad);
        }

        uint256 _exchangeRate = getCurrentExchangeRate();
        updateInterest(_src, _exchangeRate);
        updateInterest(_dst, _exchangeRate);

        Balance storage _dstBalance = balances[_dst];
        _srcBalance.value = _srcBalance.value.sub(_wad);
        _dstBalance.value = _dstBalance.value.add(_wad);

        emit Transfer(_src, _dst, _wad);
        return true;
    }

    function approve(address _spender, uint256 _wad) public returns (bool) {
        allowance[msg.sender][_spender] = _wad;
        emit Approval(msg.sender, _spender, _wad);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        external
        returns (bool)
    {
        return approve(spender, allowance[msg.sender][spender].add(addedValue));
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        external
        returns (bool)
    {
        return
            approve(
                spender,
                allowance[msg.sender][spender].sub(subtractedValue)
            );
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account].value;
    }

    /**
     * @dev According to the current exchange rate, get user's corresponding token balance
     *      based on the dToken amount, which has substracted dToken fee.
     * @param _account Account to query token balance.
     * @return Actual token balance based on dToken amount.
     */
    function getTokenBalance(address _account) external view returns (uint256) {
        uint256 _exchangeRate = getExchangeRate();
        uint256 _pie = rmul(
            rmul(balances[_account].value, _exchangeRate),
            BASE.sub(originationFee[0x9dc29fac])
        );
        return _pie;
    }

    function getCurrentInterest(address _account)
        external
        view
        returns (uint256)
    {
        return
            balances[_account].interest.add(
                rmul(
                    getExchangeRate().sub(balances[_account].exchangeRate),
                    balances[_account].value
                )
            );
    }

    /**
     * @dev Get the current list of the `handlers`.
     */
    function getHandler() public view returns (address[] memory) {
        (address[] memory _handlers, ) = IDispatcher(dispatcher).getHandler();
        return _handlers;
    }

    /**
     * @dev Get all deposit token amount including interest.
     */
    function getTotalBalance() external view returns (uint256) {
        address[] memory _handlers = getHandler();
        uint256 _tokenTotalBalance = 0;
        for (uint256 i = 0; i < _handlers.length; i++)
            _tokenTotalBalance = _tokenTotalBalance.add(
                IHandler(_handlers[i]).getBalance(token)
            );
        return _tokenTotalBalance;
    }

    /**
     * @dev Get maximum valid token amount in the whole market.
     */
    function getLiquidity() external view returns (uint256) {
        address[] memory _handlers = getHandler();
        uint256 _liquidity = 0;
        for (uint256 i = 0; i < _handlers.length; i++)
            _liquidity = _liquidity.add(
                IHandler(_handlers[i]).getLiquidity(token)
            );
        return _liquidity;
    }

    /**
     * @dev Current newest exchange rate, scaled by 1e18.
     */
    function getExchangeRate() public view returns (uint256) {
        address[] memory _handlers = getHandler();
        address _token = token;
        uint256 _totalToken = 0;
        for (uint256 i = 0; i < _handlers.length; i++)
            _totalToken = _totalToken.add(
                IHandler(_handlers[i]).getBalance(_token)
            );

        return
            totalSupply == 0 || _totalToken == 0
                ? data.exchangeRate
                : rdiv(_totalToken, totalSupply);
    }
}
