pragma solidity 0.5.12;

import "../library/SafeMath.sol";

contract DispatcherMock {
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
    mapping(address => bool) public isHandlerActive;

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
     * @dev Replace current handlers with _handlers and corresponding _proportions,
     * @param _handlers The list of new handlers, the 1st one will act as default hanlder.
     * @param _proportions The list of corresponding proportions.
     */
    function setHandlers(
        address[] memory _handlers,
        uint256[] memory _proportions
    ) private {
        require(
            _handlers.length == _proportions.length && _handlers.length > 0,
            "setHandlers: handlers & proportions should not have 0 or different lengths"
        );

        uint256 _sum = 0;
        for (uint256 i = 0; i < _handlers.length; i++) {
            require(
                _handlers[i] != address(0),
                "setHandlers: handlerAddr contract address invalid"
            );

            _sum = _sum.add(_proportions[i]);

            handlers.push(_handlers[i]);
            proportions[_handlers[i]] = _proportions[i];
            isHandlerActive[_handlers[i]] = true;
        }

        // The sum of proportions should be 1000000.
        require(
            _sum == totalProportion,
            "the sum of proportions must be 1000000"
        );
    }

    function setDefaultHandler(address _defaultHandler) public {
        defaultHandler = _defaultHandler;
    }

    function activeDefaultHandler() public {
        isHandlerActive[defaultHandler] = true;
    }

    function getHandlers()
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
}
