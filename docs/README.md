# dToken Allocation Dashboard

Static browser dashboard for monitoring dToken fund allocation and manually preparing rebalance transactions.

## Features

- Auto-loads the selected asset on page load.
- Supports Ethereum assets: USDT, USDC, DAI, TUSD, USDx.
- Supports BSC assets: BUSD, USDT, USDC, DAI.
- Shows total underlying, withdraw liquidity, exchange rate, largest allocation drift, handler balances, target weights, and market liquidity.
- Rebalance form supports absolute withdrawal amount, percentage of current liquidity, withdraw-all, and target deposits.
- Transaction simulation runs `eth_call` and `estimateGas` before sending.
- Wallet connection is remembered until the user disconnects.
- Side menu can be hidden or expanded and persists across refresh.

## Run Locally

```bash
cd monitor
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

The dashboard is static HTML/CSS/JavaScript and does not require a build step.

## Admin Transactions

The page only sends transactions when the connected wallet clicks an admin action. The current admin action is:

- `DToken.rebalance(address[],uint256[],address[],uint256[])`

Before sending, the dashboard simulates the same calldata using:

- `eth_call`
- `estimateGas`

If the selected asset is on BSC, the wallet is asked to switch to BSC before simulation or send.

## Notes

- Public RPC endpoints are configured in `index.html` via the asset buttons.
- For production use, replace public RPCs with reliable provider endpoints.
- Tenderly-style simulation should be added through a backend endpoint so API keys are not exposed in this static frontend.
