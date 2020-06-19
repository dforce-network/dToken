pragma solidity 0.5.12;

// interfaces
import "../library/SafeMath.sol";

contract AaveLendingPoolCoreMock {
    mapping(address => address) tokens;

    function transferReserveFrom(address _token, address _from, uint256 _amount) public {
        IERC20(_token).transferFrom(_from, address(this), _amount);
    }

    function getReserveATokenAddress(address _reserve)
        public
        view
        returns (address)
    {
        return tokens[_reserve];
    }

    function setReserveATokenAddress(address _newRes, address _reserve) public {
        tokens[_newRes] = _reserve;
    }

    function getReserveAvailableLiquidity(address _reserve)
        external
        view
        returns (uint256) {
            // TODO: for eth?
            IERC20(_reserve).balanceOf(address(this));
        }

    function transferOut(address _tokenID, address _to, uint _amount) public {
        IERC20(_tokenID).transfer(_to, _amount);
    }
}

contract AaveLendPoolMock {
    address public lendingPoolCore;

    constructor(
        address _core
    ) public {
        lendingPoolCore = _core;
    }

    function deposit(
        address _token,
        uint256 _amount,
        uint16
    ) external payable {
        AaveLendingPoolCoreMock(lendingPoolCore).transferReserveFrom(_token, msg.sender, _amount);
        address aToken = AaveLendingPoolCoreMock(lendingPoolCore).getReserveATokenAddress(_token);
        IERC20(aToken)._mint(msg.sender, _amount);
    }
}

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function _mint(address _account, uint256 _amount) external;

    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

contract ERC20 is IERC20 {
    using SafeMath for uint256;

    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender)
        public
        view
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) public returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            msg.sender,
            _allowances[sender][msg.sender].sub(amount)
        );
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        public
        returns (bool)
    {
        _approve(
            msg.sender,
            spender,
            _allowances[msg.sender][spender].add(addedValue)
        );
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        returns (bool)
    {
        _approve(
            msg.sender,
            spender,
            _allowances[msg.sender][spender].sub(subtractedValue)
        );
        return true;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _balances[sender] = _balances[sender].sub(amount);
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 value
    ) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}

// contract aUSDCMock is ERC20, AToken {
contract aUSDCMock is ERC20 {
    address public lendingPoolCore;
    address public usdc;
    uint256 public price = 10**18;
    mapping(address => uint256) public balance;
    mapping(address => uint256) public principalBalance;

    constructor(address _usdc, address tokenOwner, address _core) public {
        usdc = _usdc;
        lendingPoolCore = _core;
        _mint(address(this), 10**21); // 1 thousand aUSDC
        _mint(tokenOwner, 10**24); // 1 million aUSDC
    }

    function _mint(address _account, uint256 _amount) public {
        if (principalBalance[_account] == 0) {
            principalBalance[_account] = principalBalance[_account] + _amount;
        } else {
            principalBalance[_account] =
                principalBalance[_account] +
                _amount +
                50000; // 50000 for interest
        }
        balance[_account] = principalBalance[_account];
    }

    function redeem(uint256 _amount) external {
        require(_amount <= balance[msg.sender], "Insufficient aToken");
        balance[msg.sender] = balance[msg.sender] - _amount;
        AaveLendingPoolCoreMock(lendingPoolCore).transferOut(usdc, msg.sender, _amount);
    }

    function addInterest(address _account, uint256 _amount) public {
        balance[_account] = balance[_account] + _amount;
    }

    function balanceOf(address _account) public view returns (uint256) {
        return balance[_account];
    }

    function principalBalanceOf(address _account)
        external
        view
        returns (uint256)
    {
        return principalBalance[_account];
    }
}
