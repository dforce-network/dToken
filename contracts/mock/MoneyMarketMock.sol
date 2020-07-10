pragma solidity 0.5.12;

import "../library/DSAuth.sol";
import "../library/SafeMath.sol";
import "../library/ERC20SafeTransfer.sol";

import "@nomiclabs/buidler/console.sol";

contract MoneyMarketMock is DSAuth, ERC20SafeTransfer {
    using SafeMath for uint256;

    struct Balance {
        uint256 principal;
        uint256 interest;
    }

    mapping(address => mapping(address => Balance)) public supplyBalances;

    uint256 public totalBalance;

    function supply(address _token, uint256 _amount)
        external
        returns (uint256)
    {
        Balance storage balance = supplyBalances[msg.sender][_token];

        // Return some error code if the transfer failed
        if (!doTransferFrom(_token, msg.sender, address(this), _amount)) {
            return 1;
        }

        balance.principal = balance.principal.add(balance.interest).add(
            _amount
        );
        balance.interest = 0;

        return 0;
    }

    function withdraw(address _token, uint256 _amount)
        external
        returns (uint256)
    {
        Balance storage balance = supplyBalances[msg.sender][_token];
        uint256 totalBalance = balance.principal.add(balance.interest);

        uint256 amount = (_amount == uint256(-1)) ? totalBalance : _amount;

        balance.principal = totalBalance.sub(amount);
        balance.interest = 0;

        // Return some error code if the transfer failed
        if (!doTransferOut(_token, msg.sender, amount)) {
            return 1;
        }

        return 0;
    }

    function getSupplyBalance(address _user, address _token)
        external
        view
        returns (uint256)
    {
        Balance storage balance = supplyBalances[_user][_token];
        uint256 totalBalance = balance.principal.add(balance.interest);

        return totalBalance;
    }
}
