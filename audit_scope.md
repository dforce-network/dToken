### Audit Scope:

- DTokenProxy.sol

- DToken.sol

- DTokenController.sol

- Dispatcher.sol

- InternalHandler.sol

- CompoundHandler.sol

- AaveHandler.sol

### Audit Target:

- If the contract upgradability logic is correct.

- If the underlying token in dToken is secure and not exposure to any risks.

- If dToken is compatible with underlying tokens such as USDx/USDT(Non-standard ERC20)/USDC/DAI/TUSD/PAX/BUSD/HUSD/HBTC/rBTC/WBTC/imBTC(ERC777), especially non-standard erc20 and erc777 compliant token.

- If able to handle governance token of underlying supported protocols (i.e Compound).

- If handler are able to properly integrate with lending protocols, such as compound / aave.

- If the calculation of dToken exchange rate is correct, especially when allocated to Compound and interacting with cToken, is there any possible for exchange rate manipulation and attack vector.

* If allocation strategy (when deposit) and withdraw strategy(when burn/redeem) are implemented correct.

* If rebalance functionality is properly implemented.

* If authority functionality is properly implemented.

* If dToken is exposed to any Flashloan attack vector(interest rate calculation difference of supported protocols)

* Hint: resetHandlers function is kind of recovery tool, internalHander must be set to index 0 position.
