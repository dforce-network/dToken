pragma solidity 0.5.12;

interface IDispatcher {
    function getHandler()
        external
        view
        returns (address[] memory, uint256[] memory);

    function getDepositStrategy(uint256 _amount)
        external
        view
        returns (address[] memory, uint256[] memory);

    function getWithdrawStrategy(address _token, uint256 _amount)
        external
        returns (address[] memory, uint256[] memory);

    function handlerActive(address _handler) external view returns (bool);

    function defaultHandler() external view returns (address);
}
