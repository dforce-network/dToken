pragma solidity 0.5.12;

import "../interface/IHandler.sol";

contract TestHandlerMock {
    uint256 public returnValue;

    constructor() public {}

    function getRealBalance(address _handlder, address _underlyingToken)
        external
    {
        returnValue = IHandler(_handlder).getBalance(_underlyingToken);
    }

    function getRealLiquidity(address _handlder, address _underlyingToken)
        external
    {
        returnValue = IHandler(_handlder).getLiquidity(_underlyingToken);
    }

    function deposit(
        address _handlder,
        address _underlyingToken,
        uint256 _amount
    ) external {
        returnValue = IHandler(_handlder).deposit(_underlyingToken, _amount);
    }
}
