pragma solidity 0.5.12;

import "./interface/IUniswapV2Router02.sol";
import "./interface/IDToken.sol";
import "./interface/IDispatcher.sol";
import "./library/ERC20SafeTransfer.sol";

interface IRewardSwapModel {
  function swap(address reward, uint256 amount) external;
}

contract UniswapSwapModel is IRewardSwapModel, ERC20SafeTransfer {
  // !!!! Hard code address for UniswapV2Router02,
  // Change it to corresponding address for mainnet or testnet
  // Mainet and testnet
  address public constant router = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
  // Localhost for development
  address public constant router = 0xFAe0fd738dAbc8a0426F47437322b6d026A9FD95;

  function swap(address _token, uint256 _amount) external {
    IDToken _dtoken = IDToken(address(this));

    // Trasfer the swapped token to internal handler
    address _recipient = IDispatcher(_dtoken.dispatcher()).defaultHandler();

    // Swap to underlying token
    address _underlying = _dtoken.token();

    _swap(_token, _underlying, _recipient, _amount);
  }

  function _swap(
    address _tokenA,
    address _tokenB,
    address _to,
    uint256 _amount
  ) internal {
    address _router = router;

    require(doApprove(_tokenA, _router, _amount), "_swap: approve failed.");

    // amountOutMin must be retrieved from an oracle of some kind
    uint256 _amountOutMin = 0;
    address[] memory _path = new address[](2);

    // We can add some intermediate token if the direct pair does not exist
    _path[0] = _tokenA;
    _path[1] = _tokenB;

    IUniswapV2Router02(_router).swapExactTokensForTokens(
      _amount,
      _amountOutMin,
      _path,
      _to,
      block.timestamp
    );
  }
}
