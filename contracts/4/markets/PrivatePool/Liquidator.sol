pragma solidity ^0.4.24;

import "./EIP20Interface.sol";
import "./EIP20NonStandardInterface.sol";
import "./ErrorReporter.sol";
import "./InterestRateModel.sol";
import "./SafeToken.sol";

contract LiquidationChecker {
    function setAllowLiquidation(bool allowLiquidation_) public;
}

contract MoneyMarket {
    struct Market {
        bool isSupported;
        uint256 blockNumber;
        InterestRateModel interestRateModel;
        uint256 totalSupply;
        uint256 supplyRateMantissa;
        uint256 supplyIndex;
        uint256 totalBorrows;
        uint256 borrowRateMantissa;
        uint256 borrowIndex;
    }

    mapping(address => Market) public markets;

    function liquidateBorrow(
        address targetAccount,
        address assetBorrow,
        address assetCollateral,
        uint256 requestedAmountClose
    ) public returns (uint256);

    function withdraw(address asset, uint256 requestedAmount)
        public
        returns (uint256);

    function getSupplyBalance(address account, address asset)
        public
        view
        returns (uint256);

    function getBorrowBalance(address account, address asset)
        public
        view
        returns (uint256);
}

contract Liquidator is ErrorReporter, SafeToken {
    MoneyMarket public moneyMarket;

    constructor(address moneyMarket_) public {
        moneyMarket = MoneyMarket(moneyMarket_);
    }

    event BorrowLiquidated(
        address targetAccount,
        address assetBorrow,
        uint256 borrowBalanceBefore,
        uint256 borrowBalanceAccumulated,
        uint256 amountRepaid,
        uint256 borrowBalanceAfter,
        address liquidator,
        address assetCollateral,
        uint256 collateralBalanceBefore,
        uint256 collateralBalanceAccumulated,
        uint256 amountSeized,
        uint256 collateralBalanceAfter
    );

    function liquidateBorrow(
        address targetAccount,
        address assetBorrow,
        address assetCollateral,
        uint256 requestedAmountClose
    ) public returns (uint256) {
        require(targetAccount != address(this), "FAILED_LIQUIDATE_LIQUIDATOR");
        require(targetAccount != msg.sender, "FAILED_LIQUIDATE_SELF");
        require(msg.sender != address(this), "FAILED_LIQUIDATE_RECURSIVE");
        require(assetBorrow != assetCollateral, "FAILED_LIQUIDATE_IN_KIND");

        InterestRateModel interestRateModel;
        (, , interestRateModel, , , , , , ) = moneyMarket.markets(assetBorrow);

        require(
            interestRateModel != address(0),
            "FAILED_LIQUIDATE_NO_INTEREST_RATE_MODEL"
        );
        require(
            checkTransferIn(assetBorrow, msg.sender, requestedAmountClose) ==
                Error.NO_ERROR,
            "FAILED_LIQUIDATE_TRANSFER_IN_INVALID"
        );

        require(
            doTransferIn(assetBorrow, msg.sender, requestedAmountClose) ==
                Error.NO_ERROR,
            "FAILED_LIQUIDATE_TRANSFER_IN_FAILED"
        );

        tokenAllowAll(assetBorrow, moneyMarket);

        LiquidationChecker(interestRateModel).setAllowLiquidation(true);

        uint256 result = moneyMarket.liquidateBorrow(
            targetAccount,
            assetBorrow,
            assetCollateral,
            requestedAmountClose
        );

        require(
            moneyMarket.withdraw(assetCollateral, uint256(-1)) ==
                uint256(Error.NO_ERROR),
            "FAILED_LIQUIDATE_WITHDRAW_FAILED"
        );

        LiquidationChecker(interestRateModel).setAllowLiquidation(false);

        // Ensure there's no remaining balances here
        require(
            moneyMarket.getSupplyBalance(address(this), assetCollateral) == 0,
            "FAILED_LIQUIDATE_REMAINING_SUPPLY_COLLATERAL"
        ); // just to be sure
        require(
            moneyMarket.getSupplyBalance(address(this), assetBorrow) == 0,
            "FAILED_LIQUIDATE_REMAINING_SUPPLY_BORROW"
        ); // just to be sure
        require(
            moneyMarket.getBorrowBalance(address(this), assetCollateral) == 0,
            "FAILED_LIQUIDATE_REMAINING_BORROW_COLLATERAL"
        ); // just to be sure
        require(
            moneyMarket.getBorrowBalance(address(this), assetBorrow) == 0,
            "FAILED_LIQUIDATE_REMAINING_BORROW_BORROW"
        ); // just to be sure

        // Transfer out everything remaining
        tokenTransferAll(assetCollateral, msg.sender);
        tokenTransferAll(assetBorrow, msg.sender);

        return uint256(result);
    }

    function tokenAllowAll(address asset, address allowee) internal {
        EIP20Interface token = EIP20Interface(asset);

        if (token.allowance(address(this), allowee) != uint256(-1)) {
            // require(token.approve(allowee, uint(-1)), "FAILED_LIQUIDATE_ASSET_ALLOWANCE_FAILED");
            require(
                doApprove(asset, allowee, uint256(-1)) == Error.NO_ERROR,
                "FAILED_LIQUIDATE_ASSET_ALLOWANCE_FAILED"
            );
        }
    }

    function tokenTransferAll(address asset, address recipient) internal {
        uint256 balance = getBalanceOf(asset, address(this));

        if (balance > 0) {
            require(
                doTransferOut(asset, recipient, balance) == Error.NO_ERROR,
                "FAILED_LIQUIDATE_TRANSFER_OUT_FAILED"
            );
        }
    }
}
