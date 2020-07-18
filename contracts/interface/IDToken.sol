pragma solidity 0.5.12;

interface IDToken {
    function token() external view returns (address);

    function dispatcher() external view returns (address);
}
