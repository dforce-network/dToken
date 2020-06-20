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
    mapping(address => uint256) public proportions;

    uint256 public constant totalProportion = 1000000;

    /**
     * @dev map: handlerAddress -> true/false,
     *      Whether the handler has been added or not.
     */
    mapping(address => bool) public handlerActive;

    /**
     * @dev Set original handler contract and its depoist ratio.
     *      Notice: the sum of all deposit ratio should be 1000000.
     * @param _handlers The original support handler contract.
     * @param _proportions The original depoist ratio of support handler.
     */
    constructor(address[] memory _handlers, uint256[] memory _proportions)
        public
    {
        setHandlers(_handlers, _proportions);
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
     * @dev Set config for `handlers` and corresponding `proportions`.
     * @param _handlers The support handler contract.
     * @param _proportions Depoist ratio of support handler.
     */
    function setHandlers(
        address[] memory _handlers,
        uint256[] memory _proportions
    ) private {
        // The length of `_handlers` must be equal to the length of `_proportions`.
        require(
            _handlers.length == _proportions.length && _handlers.length > 0,
            "setHandlers: array parameters mismatch"
        );
        defaultHandler = _handlers[0];
        uint256 _sum = 0;
        for (uint256 i = 0; i < _handlers.length; i++) {
            require(
                _handlers[i] != address(0),
                "setHandlers: handlerAddr contract address invalid"
            );
            require(
                !handlerActive[_handlers[i]],
                "setHandlers: handler contract address already exists"
            );
            _sum = _sum.add(_proportions[i]);

            handlers.push(_handlers[i]);
            proportions[_handlers[i]] = _proportions[i];
            handlerActive[_handlers[i]] = true;
        }
        // If the `handlers` is not empty, the sum of `proportions` should be 1000000.
        require(
            _sum == totalProportion,
            "the sum of proportions must be 1000000"
        );
    }

    /**
     * @dev Update `proportions` of the `handlers`.
     * @param _handlers List of the `handlers` to update.
     * @param _proportions List of the `promotions` corresponding to `handlers` to update.
     */
    function updateProportion(
        address[] memory _handlers,
        uint256[] memory _proportions
    ) public auth {
        // The length of `_handlers` must be equal to the length of `_proportions`
        require(
            _handlers.length == _proportions.length &&
                handlers.length == _proportions.length,
            "updateProportion: array parameters mismatch"
        );

        uint256 _sum = 0;
        for (uint256 i = 0; i < _proportions.length; i++) {
            require(
                handlerActive[_handlers[i]],
                "updateProportion: the handler contract address does not exist"
            );
            _sum = _sum.add(_proportions[i]);

            proportions[_handlers[i]] = _proportions[i];
        }

        // The sum of `proportions` should be 1000000.
        require(
            _sum == totalProportion,
            "the sum of proportions must be 1000000"
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
            proportions[_handlers[i]] = 0;
            handlerActive[_handlers[i]] = true;
        }
    }

    /**
     * @dev Set config for `handlers` and corresponding `proportions`.
     * @param _handlers The support handler contract.
     * @param _proportions Depoist ratio of support handler.
     */
    function resetHandlers(
        address[] calldata _handlers,
        uint256[] calldata _proportions
    ) external auth {
        address[] memory _oldHandlers = handlers;
        for (uint256 i = 0; i < _oldHandlers.length; i++) {
            delete proportions[_oldHandlers[i]];
            delete handlerActive[_oldHandlers[i]];
        }
        defaultHandler = address(0);
        delete handlers;

        setHandlers(_handlers, _proportions);
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
                proportions[_defaultHandler] = proportions[_oldDefaultHandler];
                handlerActive[_defaultHandler] = true;
                delete proportions[_oldDefaultHandler];
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
        uint256[] memory _proportions = new uint256[](_handlers.length);
        for (uint256 i = 0; i < _proportions.length; i++)
            _proportions[i] = proportions[_handlers[i]];

        return (_handlers, _proportions);
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
                _amount.mul(proportions[_handlers[i]]) /
                totalProportion;
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
        if (_handlers.length > 2)
            sortByLiquidity(
                _handlers,
                int256(1),
                int256(_handlers.length - 1),
                _token
            );

        uint256[] memory _amounts = new uint256[](_handlers.length);
        uint256 _balance;
        uint256 _lastIndex = _amounts.length.sub(1);
        for (uint256 i = 0; i < _handlers.length; i++) {
            if (IHandler(_handlers[i]).paused()) {
                delete _handlers;
                delete _amounts;
                break;
            }

            if (_amount == 0) continue;

            if (i == _lastIndex) {
                _amounts[i] = _amount;
                break;
            }
            // The minimum amount can be withdrew from corresponding market.
            _balance = IHandler(_handlers[i]).getRealLiquidity(_token);
            _amounts[i] = _balance > _amount ? _amount : _balance;
            _amount = _amount.sub(_amounts[i]);
        }

        return (_handlers, _amounts);
    }
}
