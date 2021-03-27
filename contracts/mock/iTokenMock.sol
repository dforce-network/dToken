pragma solidity 0.5.12;

import "../library/ERC20SafeTransfer.sol";
import "../library/SafeMath.sol";

contract Token {
    function allocateTo(address _to, uint256 _amount) public;
}

contract RewardDistributor is ERC20SafeTransfer {
    using SafeMath for uint256;

    address public rewardToken;
    uint256 public accrualBlockNumber;
    uint256 constant public rewardSpeed = 1e18;
    mapping(address => uint256) public reward;

    constructor(address _rewardToken) public {
        rewardToken = _rewardToken;
        accrualBlockNumber = block.number;
    }
    /**
     * @notice Claim reward accrued in iTokens by the holders
     * @param _holders The account to claim for
     * @param _iTokens The _iTokens to claim from
     */
    function claimReward(address[] calldata _holders, address[] calldata _iTokens)
        external
    {
        _iTokens;
        for (uint256 j = 0; j < _holders.length; j++) {
            address _account = _holders[j];
            _updateReward(_account);
            uint256 _reward = reward[_account];
            if (_reward > 0) {
                reward[_account] = 0;
                Token(rewardToken).allocateTo(address(this), _reward);
                doTransferOut(rewardToken, _account, _reward);
            }
        }
    }

    function _updateReward(address _account) public {
        uint256 _rewardAmount = block.number.sub(accrualBlockNumber).mul(rewardSpeed);
        reward[_account] = reward[_account].add(_rewardAmount);
    }
}

contract Controller {

    RewardDistributor public rewardDistributor;

    constructor(RewardDistributor _rewardDistributor) public {
        rewardDistributor = _rewardDistributor;
    }
}

contract iTokenMock is ERC20SafeTransfer {
    using SafeMath for uint256;
    // --- Data ---
    uint256 constant BASE = 10**18;

    uint256 public interestRate;
    uint256 public exchangeRate;
    uint256 public random;
    uint256 public blockNumber;

    address public token;

    // --- ERC20 Data ---
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    Controller public controller;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // --- Event ---
    event Approval(address indexed src, address indexed guy, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);

    /**
     * The constructor is used here to ensure that the implementation
     * contract is initialized. An uncontrolled implementation
     * contract might lead to misleading state
     * for users who accidentally interact with it.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        Controller _controller,
        address _token
    ) public {
        initialize(_name, _symbol, _controller, _token);
    }

    // --- Init ---
    function initialize(
        string memory _name,
        string memory _symbol,
        Controller _controller,
        address _token
    ) public {
        name = _name;
        symbol = _symbol;
        decimals = 8;
        controller = _controller;
        token = _token;
        interestRate = BASE / (20 * 255);
        exchangeRate = BASE;
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

    function updateExchangeRate(uint256 _percentage) public {
        uint256 _balance = IERC20(token).balanceOf(address(this));
        Token(token).allocateTo(address(this), rmul(_balance, _percentage));
        exchangeRateCurrent();
    }

    function exchangeRateCurrent() public returns (uint256) {
        // if (blockNumber != block.number) {
        //     uint256 _random = uint256(uint8(abi.encodePacked(msg.sender)[random]));
        //     _random = uint256(
        //         uint8(abi.encodePacked(blockhash(block.number - 12))[_random % 32])
        //     );
        //     uint256 _balance = IERC20(token).balanceOf(address(this));
        //     Token(token).allocateTo(
        //         address(this),
        //         rmul(_balance, interestRate.mul(_random))
        //     );
        //     random = _random % 20;
        //     blockNumber = block.number;
        //     _balance = IERC20(token).balanceOf(address(this));
        //     exchangeRate = totalSupply == 0 || _balance == 0
        //         ? exchangeRate
        //         : rdiv(IERC20(token).balanceOf(address(this)), totalSupply);
        // }
        // return exchangeRate;
        uint256 _balance = IERC20(token).balanceOf(address(this));
        exchangeRate = totalSupply == 0 || _balance == 0
            ? exchangeRate
            : rdiv(_balance, totalSupply);
        return exchangeRate;
    }

    function balanceOfUnderlying(address _src) external returns (uint256) {
        return rmul(balanceOf[_src], exchangeRateCurrent());
    }

    /**
     * @dev Deposit token to earn savings, but only when the contract is not paused.
     * @param _dst Account who will get iToken.
     * @param _pie amount to buy, scaled by 1e18.
     */
    function mint(address _dst, uint256 _pie) external {
        address _token = token;
        exchangeRate = exchangeRateCurrent();
        uint256 _wad = rdiv(_pie, exchangeRate);
        balanceOf[_dst] = balanceOf[_dst].add(_wad);
        totalSupply = totalSupply.add(_wad);
        require(
            doTransferFrom(_token, msg.sender, address(this), _pie),
            "mint: "
        );
        emit Transfer(address(0), _dst, _wad);
    }

    /**
     * @dev Withdraw to get token according to input DToken amount, but only when the contract is not paused.
     * @param _src Account who will spend iToken.
     * @param _wad amount to burn DToken, scaled by 1e18.
     */
    function redeem(address _src, uint256 _wad) external {
        exchangeRate = exchangeRateCurrent();
        balanceOf[_src] = balanceOf[_src].sub(_wad);
        totalSupply = totalSupply.sub(_wad);
        require(
            doTransferOut(token, msg.sender, rmul(_wad, exchangeRate)),
            "iToken redeem: Token redeem of contract failed."
        );
        emit Transfer(_src, address(0), _wad);
    }

    function redeemUnderlying(address _src, uint256 _pie) external {
        exchangeRate = exchangeRateCurrent();
        uint256 _wad = rdiv(_pie.mul(BASE), exchangeRate) / BASE;
        balanceOf[_src] = balanceOf[_src].sub(_wad);
        totalSupply = totalSupply.sub(_wad);
        require(
            doTransferOut(token, msg.sender, _pie),
            "iToken redeem: Token redeem of contract failed."
        );
        emit Transfer(_src, address(0), _wad);
    }

    // --- Token ---
    function transfer(address _dst, uint256 _wad) external returns (bool) {
        return transferFrom(msg.sender, _dst, _wad);
    }

    function transferFrom(
        address _src,
        address _dst,
        uint256 _wad
    ) public returns (bool) {
        require(balanceOf[_src] >= _wad, "transferFrom: insufficient balance");
        if (_src != msg.sender && allowance[_src][msg.sender] != uint256(-1)) {
            require(
                allowance[_src][msg.sender] >= _wad,
                "transferFrom: insufficient allowance"
            );
            allowance[_src][msg.sender] = allowance[_src][msg.sender].sub(_wad);
        }
        balanceOf[_src] = balanceOf[_src].sub(_wad);
        balanceOf[_dst] = balanceOf[_dst].add(_wad);
        emit Transfer(_src, _dst, _wad);
        return true;
    }

    function approve(address _spender, uint256 _wad) external returns (bool) {
        allowance[msg.sender][_spender] = _wad;
        emit Approval(msg.sender, _spender, _wad);
        return true;
    }

    function exchangeRateStored() external view returns (uint256) {
        return exchangeRate;
    }

    function getCash() external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
