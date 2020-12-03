### Send Transactions

- mint(address \_dst, uint \_pie)

  - \_dst: account who will get dtoken.
  - \_pie: underlying token amount.

- redeem(address \_src, uint \_wad)

  - \_src: account whose dtoken will burn from.
  - \_wad: dtoken amount to burn.

- redeemUnderlying(address \_src, uint \_pie)

  - \_src: account whose dtoken will burn from.
  - \_pie: underlying token amount to withdraw.

- approve(address \_spender, uint \_wad) returns (bool)

  - \_spender: approved spender.
  - \_wad: amount to approve.
  - returns: true if success.

- transfer(address \_dst, uint \_wad) returns (bool)

  - \_dst: recipient address.
  - \_wad: amount to transfer.
  - returns: true if success.

- transferFrom(address \_src, address \_dst, uint \_wad) returns (bool)

  - \_src: sender address.
  - \_dst: recipient address.
  - \_wad: amount to transfer.
  - returns: true if success.

### call

- name() returns (string)

  - returns: token name.

- symbol() returns (string)

  - returns: token symbol.

- decimals() returns (uint8)

  - returns: token decimals.

- totalSupply() returns (uint)

  - returns: total dtoken anmount.

- balanceOf(address \_account) returns (uint)

  - \_account: account address.
  - returns: dtoken balance of given account.

- allowance(address \_owner, address \_spender) returns (uint)

  - \_owner: owner address.
  - \_spender: spender address.
  - returns: the amount which \_spender is still allowed to withdraw from \_owner.

- currentExchangeRate() returns (uint)

  - returns: the most recent exchange rate, scaled by 1e18.

- totalUnderlying() returns (uint)

  - returns: the total underlying token amount.

- getRealLiquidity() returns (uint)

  - returns: current liquidity of the underlying token.

  balanceOfUnderlying(address \_account) returns (uint)

  - \_account: account address.
  - returns: underlying token balance of given account.

- getBaseData() returns (uint, uint, uint, uint, uint)

  - returns (decimals, exchangeRate, mintFeeRate, redeemFeeRate, totalUnderlying)
    - decimals: token decimals.
    - exchangeRate: the most recent exchange rate, scaled by 1e18.
    - mintFeeRate: the fee rate of mint(), scaled by 1e18.
    - redeemFeeRate: the fee rate of redeem()/redeemUnderlying(), scaled by 1e18.
    - totalUnderlying: the total underlying token amount.

- originationFee(bytes4 \_sig) returns (uint)

  - \_sig: function signature to query.
  - returns: fee, scaled by 1e18.

- paused() returns (bool)

  - returns: true if paused, false if not paused.

- feeRecipient() returns (address)

  - returns: fee receiving address.
