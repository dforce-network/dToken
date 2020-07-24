pragma solidity 0.5.12;

interface IDFDistributor {
    function claimDF(address dToken, address account) external;
}
