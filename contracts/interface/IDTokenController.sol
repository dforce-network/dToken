pragma solidity 0.5.12;

interface IDTokenController {
    function getDToken(address _token) external view returns (address);
}
