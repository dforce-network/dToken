pragma solidity 0.5.12;

interface IDToken {
    event LogSetAuthority(address indexed authority);
    event LogSetOwner(address indexed owner);
    event OwnerUpdate(address indexed owner, address indexed newOwner);

    function authority() external view returns (address);

    function owner() external view returns (address);

    function newOwner() external view returns (address);

    function disableOwnership() external;

    function transferOwnership(address _newOwner) external;

    function acceptOwnership() external;

    function setAuthority(address _authority) external;

    event Paused(address account);
    event Unpaused(address account);

    function paused() external view returns (bool);

    function pause() external;

    function unpause() external;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address _account) external view returns (uint256);

    function allowance(address _owner, address _spender)
        external
        view
        returns (uint256);

    function approve(address _spender, uint256 _amount) external returns (bool);

    function increaseAllowance(address _spender, uint256 _addedValue)
        external
        returns (bool);

    function decreaseAllowance(address _spender, uint256 _subtractedValue)
        external
        returns (bool);

    function transfer(address _recipient, uint256 _amount)
        external
        returns (bool);

    function transferFrom(
        address _sender,
        address _recipient,
        uint256 _amount
    ) external returns (bool);

    event Interest(
        address indexed src,
        uint256 interest,
        uint256 increase,
        uint256 totalInterest
    );
    event Mint(
        address indexed account,
        uint256 indexed pie,
        uint256 wad,
        uint256 totalSupply,
        uint256 exchangeRate
    );
    event Redeem(
        address indexed account,
        uint256 indexed pie,
        uint256 wad,
        uint256 totalSupply,
        uint256 exchangeRate
    );

    // --- Admin Triggered Event ---
    event Rebalance(
        address[] withdraw,
        uint256[] withdrawAmount,
        address[] supply,
        uint256[] supplyAmount
    );
    event TransferFee(address token, address feeRecipient, uint256 amount);
    event FeeRecipientSet(address oldFeeRecipient, address newFeeRecipient);
    event NewDispatcher(address oldDispatcher, address Dispatcher);
    event NewOriginationFee(
        bytes4 sig,
        uint256 oldOriginationFeeMantissa,
        uint256 newOriginationFeeMantissa
    );

    event Swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut
    );

    function data() external view returns (uint256, uint256);

    function feeRecipient() external view returns (address);

    function originationFee(bytes4 _sig) external view returns (uint256);

    function dispatcher() external view returns (address);

    function token() external view returns (address);

    function swapModel() external view returns (address);

    function dfDistributor() external view returns (address);

    function balances(address _owner)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );

    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _token,
        address _dispatcher
    ) external;

    function updateDispatcher(address _newDispatcher) external;

    function setSwapModel(address _newSwapModel) external;

    function setDFDistributor(address _newDFDistributor) external;

    function setFeeRecipient(address _newFeeRecipient) external;

    function updateOriginationFee(bytes4 _sig, uint256 _newOriginationFee)
        external;

    function swap(address _token, uint256 _amount) external;

    function transferFee(address _token, uint256 _amount) external;

    function rebalance(
        address[] calldata _withdraw,
        uint256[] calldata _withdrawAmount,
        address[] calldata _deposit,
        uint256[] calldata _depositAmount
    ) external;

    function mint(address _dst, uint256 _pie) external;

    function redeem(address _src, uint256 _wad) external;

    function redeemUnderlying(address _src, uint256 _pie) external;

    function getTokenBalance(address _account) external view returns (uint256);

    function getCurrentInterest(address _account)
        external
        view
        returns (uint256);

    function getHandlers() external view returns (address[] memory);

    function getTotalBalance() external view returns (uint256);

    function getLiquidity() external view returns (uint256);

    function getExchangeRate() external view returns (uint256);

    function getBaseData()
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        );

    function getHandlerInfo()
        external
        view
        returns (
            address[] memory,
            uint256[] memory,
            uint256[] memory
        );
}
