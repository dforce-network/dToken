pragma solidity 0.5.12;

interface IUSR {
    // bool true:success, otherwise a failure (see ErrorReporter.sol for details)
    function mint(address account, uint256 mintAmount) external returns (bool);

    // bool true:success, otherwise a failure (see ErrorReporter.sol for details)
    function redeemUnderlying(address account, uint256 underlyingAmount)
        external
        returns (bool);

    function redeem(address account, uint256 amount) external returns (bool);

    function balanceOfUnderlying(address owner) external returns (uint256);

    function underlyingToken() external view returns (address);
}
