pragma solidity 0.5.12;

import "./interface/IUniswapV2Router02.sol";
import "./interface/IDToken.sol";
import "./interface/IDispatcher.sol";
import "./library/ERC20SafeTransfer.sol";

interface ISwapModel {
    function swap(address reward, uint256 amount) external;
}

contract UniswapSwapModel is ISwapModel, ERC20SafeTransfer {
    event Swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut
    );

    function swap(address _token, uint256 _amount) external {
        IDToken _dtoken = IDToken(address(this));

        // Trasfer the swapped token to internal handler
        address _recipient = IDispatcher(_dtoken.dispatcher()).defaultHandler();

        // Swap to underlying token
        address _underlying = _dtoken.token();

        uint256[] memory amounts = _swap(
            _token,
            _underlying,
            _recipient,
            _amount
        );

        require(amounts.length >= 2, "swap: swap returned wrong amounts");

        emit Swap(_token, amounts[0], _underlying, amounts[amounts.length - 1]);
    }

    function _swap(
        address _tokenA,
        address _tokenB,
        address _to,
        uint256 _amount
    ) internal returns (uint256[] memory amounts) {
        // !!!! Hard code address for UniswapV2Router02,
        // Change it to corresponding address for mainnet or testnet

        // Mainnet and testnet
        // address router = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

        // Localhost for development, use accounts[accounts.length-1] to deploy
        address router = 0x4607B8eBBC7953d709238937844327EA107462F9;

        require(doApprove(_tokenA, router, _amount), "_swap: approve failed.");

        IUniswapV2Router02 _router = IUniswapV2Router02(router);

        // amountOutMin must be retrieved from an oracle of some kind
        uint256 _amountOutMin = 0;
        address[] memory _path = new address[](3);

        // We can add some intermediate token if the direct pair does not exist
        _path[0] = _tokenA;
        _path[1] = _router.WETH();
        _path[2] = _tokenB;

        return
            _router.swapExactTokensForTokens(
                _amount,
                _amountOutMin,
                _path,
                _to,
                block.timestamp
            );
    }
}
