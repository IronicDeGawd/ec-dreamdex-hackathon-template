# TypeScript path — `@somnia-chain/markets-sdk`

The SDK gives you the whole Event Contract lifecycle as a handful of method
calls. This folder is the thinnest possible wrapper around them so you can see
the shape and then build your own app on top.

## Setup

```bash
cp ../.env.example ../.env    # then fill in PRIVATE_KEY with a funded testnet key
npm install
```

Fund the wallet with testnet tUSDC (collateral) + STT (gas) from the faucet
group: **https://t.me/+XHq0F0JXMyhmMzM0**

> The scripts must run under **tsx**, not plain `node` — the SDK ships ESM with
> extensionless imports that `node` cannot resolve. `npm run ...` already uses tsx.

## Run

```bash
npm run discover     # list live markets discovered straight from chain logs
npm run lifecycle    # mint -> place maker -> cross with taker -> save market.json
npm run redeem       # (after the window expires) claim the winning side
```

## The methods you actually care about

| Call | What it does |
|---|---|
| `ex.trader.mintSet({ pool, amount })` | 1 collateral → 1 Up + 1 Down token |
| `ex.trader.burnSet({ pool, amount })` | Merge 1 Up + 1 Down → 1 collateral |
| `ex.trader.placeOrder({ pool, side, price, quantity, orderType })` | Rest or cross an order |
| `ex.trader.cancelOrder({ pool, orderId })` | Cancel a resting order |
| `ex.trader.redeem({ marketId, amount, outcomeIdx, market })` | Claim a settled position |
| `ex.client.getMarketOnchain(marketId)` | Status + outcome-token ids |
| `ex.client.getOutcomeBalance({ outcomeToken, account, id })` | Your Up / Down holdings |
| `ex.client.getAllOpenOrdersOnchain(pool, { isBid })` | The order book |
| `ex.client.listBinaryMarkets({})` | Indexer discovery (fallback: chain logs, see `discover.mjs`) |

- **`side`**: `"BUY_YES" | "SELL_YES" | "BUY_NO" | "SELL_NO"` — "YES" = Up, "NO" = Down.
- **`orderType`**: `3` = PostOnly (maker, must rest), `2` = IOC (taker, must cross).
- **`price`**: probability in 1e6 units. Use `probabilityToPrice(0.9)` → `900000n`.

## Gotchas worth knowing before you burn an afternoon

- A **PostOnly order that would cross the book is silently dropped** — you get
  `success: true` but `orderId: undefined`. Check for the orderId.
- **The indexer can be down.** Anything that reads from it (`loadMarkets`,
  `listBinaryMarkets`) may fail — the discovery + read scripts here fall back to
  on-chain logs so you are never blocked.
- Somnia gas is not Ethereum gas. See the root `SKILL.md` for the traps.
