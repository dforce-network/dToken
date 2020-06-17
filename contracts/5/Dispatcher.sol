pragma solidity 0.5.12;

import "./interface/IHandler.sol";
import "./library/DSAuth.sol";
import "./library/SafeMath.sol";

contract Dispatcher is DSAuth {
    using SafeMath for uint256;

    /**
     * @dev List all handler contract address.
     */
    address[] public handlers;

    address public defaultHandler;

    /**
     * @dev Deposit ratio of each handler contract.
     *      Notice: the sum of all deposit ratio should be 1000000.
     */
    mapping(address => uint256) public propotions;

    uint256 public constant totalPropotion = 1000000;

    /**
     * @dev map: handlerAddress -> true/false,
     *      Whether the handler has been added or not.
     */
    mapping(address => bool) public handlerActive;

    /**
     * @dev Set original handler contract and its depoist ratio.
     *      Notice: the sum of all deposit ratio should be 1000000.
     * @param _handlers The original support handler contract.
     * @param _propotions The original depoist ratio of support handler.
     */
    constructor(address[] memory _handlers, uint256[] memory _propotions)
        public
    {
        setHandler(_handlers, _propotions);
    }

    /**
     * @dev Sort `handlers` from large to small according to the liquidity of the corresponding market asset.
     * @param _data The data to sort, that is the `handlers` at here.
     * @param _left The index of data to start sorting.
     * @param _right The index of data to end sorting.
     * @param _token Asset address.
     */
    function sortByLiquidity(
        address[] memory _data,
        int256 _left,
        int256 _right,
        address _token
    ) internal view {
        int256 i = _left;
        int256 j = _right;
        if (i == j) return;

        uint256 _pivot = IHandler(_data[uint256(_left + (_right - _left) / 2)])
            .getLiquidity(_token);
        while (i <= j) {
            while (IHandler(_data[uint256(i)]).getLiquidity(_token) > _pivot)
                i++;
            while (_pivot > IHandler(_data[uint256(j)]).getLiquidity(_token))
                j--;
            if (i <= j) {
                (_data[uint256(i)], _data[uint256(j)]) = (
                    _data[uint256(j)],
                    _data[uint256(i)]
                );
                i++;
                j--;
            }
        }
        if (_left < j) sortByLiquidity(_data, _left, j, _token);
        if (i < _right) sortByLiquidity(_data, i, _right, _token);
    }

    /**
     * @dev Set config for `handlers` and corresponding `propotions`.
     * @param _handlers The support handler contract.
     * @param _propotions Depoist ratio of support handler.
     */
    function setHandler(
        address[] memory _handlers,
        uint256[] memory _propotions
    ) private {
        // The length of `_handlers` must be equal to the length of `_propotions`.
        require(
            _handlers.length == _propotions.length && _handlers.length > 0,
            "setHandler: array parameters mismatch"
        );
        defaultHandler = _handlers[0];
        uint256 _sum = 0;
        for (uint256 i = 0; i < _handlers.length; i++) {
            require(
                _handlers[i] != address(0),
                "setHandler: handlerAddr contract address invalid"
            );
            require(
                !handlerActive[_handlers[i]],
                "setHandler: handler contract address already exists"
            );
            _sum = _sum.add(_propotions[i]);

            handlers.push(_handlers[i]);
            propotions[_handlers[i]] = _propotions[i];
            handlerActive[_handlers[i]] = true;
        }
        // If the `handlers` is not empty, the sum of `propotions` should be 1000000.
        if (handlers.length > 0)
            require(
                _sum == totalPropotion,
                "the sum of propotions must be 1000000"
            );
    }

    /**
     * @dev Update `propotions` of the `handlers`.
     * @param _handlers List of the `handlers` to update.
     * @param _propotions List of the `promotions` corresponding to `handlers` to update.
     */
    function updatePropotion(
        address[] memory _handlers,
        uint256[] memory _propotions
    ) public auth {
        // The length of `_handlers` must be equal to the length of `_propotions`
        require(
            _handlers.length == _propotions.length &&
                handlers.length == _propotions.length,
            "updatePropotion: array parameters mismatch"
        );

        uint256 _sum = 0;
        for (uint256 i = 0; i < _propotions.length; i++) {
            require(
                handlerActive[_handlers[i]],
                "updatePropotion: the handler contract address does not exist"
            );
            _sum = _sum.add(_propotions[i]);

            propotions[_handlers[i]] = _propotions[i];
        }

        // The sum of `propotions` should be 1000000.
        require(
            _sum == totalPropotion,
            "the sum of propotions must be 1000000"
        );
    }

    /**
     * @dev Add new handler.
     *      Notice: the corresponding ratio of the new handler is 0.
     * @param _handlers List of the new handlers to add.
     */
    function addHandler(address[] memory _handlers) public auth {
        for (uint256 i = 0; i < _handlers.length; i++) {
            require(
                !handlerActive[_handlers[i]],
                "addHandler: handler contract address already exists"
            );
            require(
                _handlers[i] != address(0),
                "addHandler: handler contract address invalid"
            );

            handlers.push(_handlers[i]);
            propotions[_handlers[i]] = 0;
            handlerActive[_handlers[i]] = true;
        }
    }

    /**
     * @dev Set config for `handlers` and corresponding `propotions`.
     * @param _handlers The support handler contract.
     * @param _propotions Depoist ratio of support handler.
     */
    function resetHandler(
        address[] calldata _handlers,
        uint256[] calldata _propotions
    ) external auth {
        address[] memory _oldHandlers = handlers;
        for (uint256 i = 0; i < _oldHandlers.length; i++) {
            delete propotions[_oldHandlers[i]];
            delete handlerActive[_oldHandlers[i]];
        }
        defaultHandler = address(0);
        delete handlers;

        setHandler(_handlers, _propotions);
    }

    /**
     * @dev Update `defaultHandler`.
     * @param _defaultHandler `defaultHandler` to update.
     */
    function updateDefaultHandler(address _defaultHandler) public auth {
        require(
            _defaultHandler != address(0),
            "updateDefaultHandler: New defaultHandler should not be zero address"
        );

        address _oldDefaultHandler = defaultHandler;
        require(
            _defaultHandler != _oldDefaultHandler,
            "updateDefaultHandler: Old and new address cannot be the same."
        );

        address[] memory _handlers = handlers;
        for (uint256 i = 0; i < _handlers.length; i++) {
            if (_oldDefaultHandler == _handlers[i]) {
                _handlers[i] = _defaultHandler;
                propotions[_defaultHandler] = propotions[_oldDefaultHandler];
                handlerActive[_defaultHandler] = true;
                delete propotions[_oldDefaultHandler];
                delete handlerActive[_oldDefaultHandler];
                break;
            }
        }

        defaultHandler = _defaultHandler;
    }

    /**
     * @dev Query the current handler and the corresponding ratio.
     * @return Return two arrays, one is the current handler,
     *         and the other is the corresponding ratio.
     */
    function getHandler()
        external
        view
        returns (address[] memory, uint256[] memory)
    {
        address[] memory _handlers = handlers;
        uint256[] memory _propotions = new uint256[](_handlers.length);
        for (uint256 i = 0; i < _propotions.length; i++)
            _propotions[i] = propotions[_handlers[i]];

        return (_handlers, _propotions);
    }

    /**
     * @dev According to the `propotion` of the `handlers`, calculate corresponding deposit amount.
     * @param _amount The amount to deposit.
     * @return Return two arrays, one is the current handler,
     *         and the other is the corresponding deposit amount.
     */
    function getDepositStrategy(uint256 _amount)
        external
        view
        returns (address[] memory, uint256[] memory)
    {
        address[] memory _handlers = handlers;

        uint256[] memory _amounts = new uint256[](_handlers.length);

        uint256 _sum = 0;
        uint256 _lastIndex = _amounts.length.sub(1);
        for (uint256 i = 0; ; i++) {
            if (IHandler(_handlers[i]).paused()) {
                delete _handlers;
                delete _amounts;
                break;
            }
            // Calculate deposit amount according to the `propotion` of the `handlers`,
            // and the last handler gets the remaining quantity directly without calculating.
            if (i == _lastIndex) {
                _amounts[i] = _amount.sub(_sum);
                break;
            }

            _amounts[i] =
                _amount.mul(propotions[_handlers[i]]) /
                totalPropotion;
            _sum = _sum.add(_amounts[i]);
        }

        return (_handlers, _amounts);
    }

    /**
     * @dev According to new `handlers` which are sorted in order from small to large base on the APR
     *      of corresponding asset, provide a best strategy when withdraw asset.
     * @param _token The asset to withdraw.
     * @param _amount The amount to withdraw including exchange fees between tokens.
     * @return Return two arrays, one is the current handler,
     *         and the other is the corresponding withdraw amount.
     */
    function getWithdrawStrategy(address _token, uint256 _amount)
        external
        returns (address[] memory, uint256[] memory)
    {
        address[] memory _handlers = handlers;
        // Sort `handlers` from large to small according to the liquidity of `_token`.
        sortByLiquidity(
            _handlers,
            int256(0),
            int256(_handlers.length - 1),
            _token
        );

        address[] memory _withdrawHandlers = new address[](_handlers.length);
        uint256[] memory _amounts = new uint256[](_handlers.length);
        address _defaultHandler = defaultHandler;
        uint256 _balance;

        _withdrawHandlers[0] = _defaultHandler;
        _balance = IHandler(_defaultHandler).getRealLiquidity(_token);
        _amounts[0] = _balance > _amount ? _amount : _balance;
        _amount = _amount.sub(_amounts[0]);

        uint256 _lastIndex = _amounts.length.sub(1);
        uint256 _index = 1;
        for (uint256 i = 0; i < _handlers.length; i++) {
            if (IHandler(_handlers[i]).paused()) {
                delete _withdrawHandlers;
                delete _amounts;
                break;
            }

            if (_handlers[i] == _defaultHandler) {
                _index = 0;
                continue;
            }

            _withdrawHandlers[i + _index] = _handlers[i];
            if (i == _lastIndex) {
                _amounts[i] = _amount;
                break;
            }
            // The minimum amount can be withdrew from corresponding market.
            _balance = IHandler(_handlers[i]).getRealLiquidity(_token);
            _amounts[i + _index] = _balance > _amount ? _amount : _balance;
            _amount = _amount.sub(_amounts[i + _index]);
        }

        return (_withdrawHandlers, _amounts);
    }
}
