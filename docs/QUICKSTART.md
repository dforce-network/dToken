# Quick Start

1. Start a local static server:

```bash
cd monitor
python3 -m http.server 8000
```

2. Open the dashboard:

```text
http://localhost:8000
```

3. Select a chain and asset from the side menu.

The default asset is Ethereum dUSDT and it loads automatically.

## Rebalance Flow

1. Connect a wallet with permission to call `rebalance`.
2. Enter withdrawal amounts directly or set a withdrawal percentage of each market's live liquidity.
3. Enter deposit amounts for target markets.
4. Click `Simulate` to run `eth_call` and gas estimation.
5. Click `Run Rebalance` only after simulation passes.
