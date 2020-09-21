pragma solidity ^0.5.12;

library SafeMath {
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require((z = x + y) >= x, "ds-math-add-overflow");
    }

    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require((z = x - y) <= x, "ds-math-sub-underflow");
    }

    function mul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x, "ds-math-mul-overflow");
    }

    function div(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y > 0, "ds-math-div-overflow");
        z = x / y;
    }
}

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function transfer(address recipient, uint256 amount) external;

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external;

    function approve(address spender, uint256 amount) external;
}

interface IDToken {
    function token() external view returns (address);

    function swapModel() external view returns (address);

    function getBaseData()
        external
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        );
}

interface ISwapModel {
    function getSwapAmount(
        address _tokenA,
        address _tokenB,
        uint256 _amount
    ) external view returns (uint256);
}

interface ICompoundHandler {
    function cTokens(address _token) external view returns (address);
}

interface ICToken {
    function comptroller() external view returns (address);
}

interface IComptroller {
    function compSpeeds(address _cToken) external view returns (uint256);

    function compSupplyState(address _cToken)
        external
        view
        returns (uint256, uint256);

    function compBorrowState(address _cToken)
        external
        view
        returns (uint256, uint256);

    function compSupplierIndex(address _cToken, address _account)
        external
        view
        returns (uint256);

    function compBorrowerIndex(address _cToken, address _account)
        external
        view
        returns (uint256);

    function compAccrued(address _account) external view returns (uint256);

    function getCompAddress() external view returns (address);
}

contract CompBalance {
    using SafeMath for uint256;

    uint256 public constant doubleScale = 1e36;
    uint256 public constant compInitialIndex = 1e36;
    uint256 constant BASE = 10**18;

    function fraction(uint256 a, uint256 b) internal pure returns (uint256) {
        return a.mul(doubleScale).div(b);
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(BASE).div(y);
    }

    function getCompBalanceByCToken(address _cToken, address _account)
        public
        view
        returns (uint256)
    {
        IComptroller _comptroller = IComptroller(
            ICToken(_cToken).comptroller()
        );
        uint256 supplySpeed = _comptroller.compSpeeds(_cToken);
        (uint256 supplyStateIndex, uint256 supplyStateBlock) = _comptroller
            .compSupplyState(_cToken);
        uint256 deltaBlocks = block.number.sub(supplyStateBlock);

        if (deltaBlocks > 0 && supplySpeed > 0) {
            uint256 supplyTokens = IERC20(_cToken).totalSupply();
            supplyStateIndex = supplyStateIndex.add(
                supplyTokens > 0
                    ? fraction(deltaBlocks.mul(supplySpeed), supplyTokens)
                    : 0
            );
        }

        uint256 supplierIndex = _comptroller.compSupplierIndex(
            _cToken,
            _account
        );
        if (supplierIndex == 0 && supplyStateIndex > 0)
            supplierIndex = compInitialIndex;

        return
            _comptroller.compAccrued(_account).add(
                IERC20(_cToken).balanceOf(_account).mul(
                    supplyStateIndex.sub(supplierIndex)
                ) / doubleScale
            );
    }

    function getCompBalanceByToken(address _token, address _account)
        public
        view
        returns (uint256)
    {
        address _cToken = ICompoundHandler(_account).cTokens(_token);
        if (_cToken == address(0)) return 0;
        return getCompBalanceByCToken(_cToken, _account);
    }

    function getCompBalanceBatchByToken(
        address[] calldata _tokens,
        address _account
    ) external view returns (address[] memory, uint256[] memory) {
        uint256[] memory _amounts = new uint256[](_tokens.length);

        for (uint256 i = 0; i < _tokens.length; i++)
            _amounts[i] = getCompBalanceByToken(_tokens[i], _account);

        return (_tokens, _amounts);
    }

    function getCompBalanceByDToken(address _dToken, address _account)
        public
        view
        returns (uint256)
    {
        return getCompBalanceByToken(IDToken(_dToken).token(), _account);
    }

    function getCompBalanceBatchByDToken(
        address[] calldata _dTokens,
        address _account
    ) external view returns (address[] memory, uint256[] memory) {
        uint256[] memory _amounts = new uint256[](_dTokens.length);

        for (uint256 i = 0; i < _dTokens.length; i++)
            _amounts[i] = getCompBalanceByDToken(_dTokens[i], _account);

        return (_dTokens, _amounts);
    }

    function getExchangeRate(address _dToken, address _account)
        public
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        uint256 _compPrice;
        uint256 _compBalance = getCompBalanceByDToken(_dToken, _account);
        (, , , , uint256 _tokenBalance) = IDToken(_dToken).getBaseData();

        address _token = IDToken(_dToken).token();
        address _cToken = ICompoundHandler(_account).cTokens(_token);
        if (_cToken == address(0))
            return (
                block.number,
                IERC20(_dToken).totalSupply(),
                _tokenBalance,
                _compBalance,
                _compPrice
            );

        address _compAddress = IComptroller(ICToken(_cToken).comptroller())
            .getCompAddress();
        _compBalance = _compBalance.add(
            IERC20(_compAddress).balanceOf(_dToken)
        );
        _compPrice = ISwapModel(IDToken(_dToken).swapModel()).getSwapAmount(
            _compAddress,
            _token,
            BASE
        );

        return (
            block.number,
            IERC20(_dToken).totalSupply(),
            _tokenBalance,
            _compBalance,
            _compPrice
        );
    }

    function getExchangeRates(address[] calldata _dTokens, address _account)
        external
        returns (
            uint256,
            address[] memory,
            uint256[] memory,
            uint256[] memory,
            uint256[] memory,
            uint256[] memory
        )
    {
        uint256[] memory _totalSupplys = new uint256[](_dTokens.length);
        uint256[] memory _tokenBalances = new uint256[](_dTokens.length);
        uint256[] memory _compBalances = new uint256[](_dTokens.length);
        uint256[] memory _compPrices = new uint256[](_dTokens.length);

        for (uint256 i = 0; i < _dTokens.length; i++)
            (
                ,
                _totalSupplys[i],
                _tokenBalances[i],
                _compBalances[i],
                _compPrices[i]
            ) = getExchangeRate(_dTokens[i], _account);

        return (
            block.number,
            _dTokens,
            _totalSupplys,
            _tokenBalances,
            _compBalances,
            _compPrices
        );
    }
}
