pragma solidity 0.5.12;

import "../library/SafeMath.sol";

contract TestERC20 {
  using SafeMath for uint256;
  // --- Data ---
  // --- ERC20 Data ---
  string public name;
  string public symbol;
  uint8 public decimals;
  uint256 public totalSupply;

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
    uint8 _decimals
  ) public {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
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
    if (balanceOf[_src] < _wad) return false;

    // HACK: When approved with -1, also decrease the allowance
    // so that the next approve will return false
    //if (_src != msg.sender && allowance[_src][msg.sender] != uint256(-1)) {
    if (_src != msg.sender) {
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
    if (allowance[msg.sender][_spender] > 0) return false;
    allowance[msg.sender][_spender] = _wad;
    emit Approval(msg.sender, _spender, _wad);
    return true;
  }

  function allocateTo(address _spender, uint256 _wad) external {
    balanceOf[_spender] = balanceOf[_spender].add(_wad);
    totalSupply = totalSupply.add(_wad);
    emit Transfer(address(0), _spender, _wad);
  }
}
