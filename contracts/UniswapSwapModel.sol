pragma solidity 0.5.12;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./interface/IDToken.sol";
import "./interface/IDispatcher.sol";
import "./library/ERC20SafeTransfer.sol";

interface IRewardSwapModel {
  function swap(address reward, uint256 amount) external;
}

contract UniswapSwapModel is IRewardSwapModel, ERC20SafeTransfer {
  bool private initialized; // Flag of initialize data

  address public router;

  constructor(address _router) public {
    initialize(_router);
  }

  // --- Init ---
  function initialize(address _router) public {
    require(!initialized, "initialize: Already initialized!");
    router = _router;
    initialized = true;
  }

  function swap(
    address dtoken,
    address reward,
    uint256 amount
  ) external {
    // Trasfer the swapped token to internal handler
    address recipient = IDispatcher(IDToken(dtoken).dispatcher())
      .defaultHandler();

    // Swap to underlying token
    address underlying = IDToken(dtoken).token();

    _swap(reward, underlying, recipient, amount);
  }

  function _swap(
    address tokenA,
    address tokenB,
    address to,
    uint256 amount
  ) internal {
    address _router = router;

    require(doApprove(tokenA, _router, amount), "_swap: approve failed.");

    // amountOutMin must be retrieved from an oracle of some kind
    uint256 amountOutMin = 0;
    address[] memory path = new address[](2);

    // We can add some intermediate token if the direct pair does not exist
    path[0] = tokenA;
    path[1] = tokenB;

    IUniswapV2Router02(_router).swapExactTokensForTokens(
      amount,
      amountOutMin,
      path,
      to,
      block.timestamp
    );
  }
}
