---
name: dreamdex-event-contracts
description: >-
  Build on DreamDEX Event Contracts (binary Up/Down prediction markets) on
  Somnia Shannon testnet. Use when a task involves minting/trading/settling
  binary outcome tokens via @somnia-chain/markets-sdk or the raw binary-pool ABI,
  or hits Somnia-specific gas/tx behavior. Covers the lifecycle, the method
  surface, the encoding, and the gotchas that waste an afternoon.
---

# DreamDEX Event Contracts — build skill

A guide for coding agents working on this starter. It gives you the primitive
and the traps; for anything not here, follow the doc links at the bottom rather
than guessing.

## What an Event Contract is

A binary prediction market on a single question ("will BTC be up at the end of
this 15-minute window?"). Each market has two outcome tokens — **Up** ("YES") and
**Down** ("NO") — as ERC-6909 ids. One unit of collateral mints one Up **and** one
Down. When the window resolves, the winning token redeems 1:1 for collateral; the
losing token is worth zero. You trade the tokens on an order book in between.

## The lifecycle (this is the whole primitive)

0. **fund** — the wallet needs testnet tUSDC (collateral) + STT (gas). Get them
   from the SomniaHacks dev group (use the faucet topic): https://t.me/+XHq0F0JXMyhmMzM0
1. **mintSet** — 1 collateral → 1 Up + 1 Down. (**burnSet** merges them back.)
2. **placeOrder** — rest a maker order or cross with a taker; buy/sell Up or Down.
3. **resolve** — after the window's expiry the market finalizes to Up or Down.
4. **redeem** — swap winning tokens back to collateral 1:1.

Your app is whatever you build around this — a UI, an agent, an analytics tool.
The lifecycle itself is not the product.

## Method surface

**SDK** (`@somnia-chain/markets-sdk`, run under `tsx`):
`mintSet({pool, amount})`, `burnSet({pool, amount})`,
`placeOrder({pool, side, price, quantity, orderType})`,
`cancelOrder({pool, orderId})`, `redeem({marketId, amount, outcomeIdx, market})`;
reads `ex.client.getMarketOnchain(marketId)`,
`getOutcomeBalance({outcomeToken, account, id})`,
`getAllOpenOrdersOnchain(pool, {isBid})`, `listBinaryMarkets({})`.

**Raw pool** (`IBinaryPool`): `placeBinaryOrder(kind, price, quantity, expireNs,
orderType, ...)`, `cancelOrder`, `getBinaryPoolParams`, `getBookLevels`,
`marketExpiryNs`, `deposit`/`withdraw`; redeem via `IBinaryMarketsModule.redeem`;
resolution via `IBinaryMarket.isResolved` / `payoutNumerators`.

## Encoding (get these wrong and orders silently misbehave)

- **Side**: SDK `"BUY_YES"|"SELL_YES"|"BUY_NO"|"SELL_NO"`; raw `kind` `0|1|2|3` in
  that order. "YES" = Up, "NO" = Down.
- **orderType**: `3`=PostOnly (maker, must rest), `2`=IOC (taker, must cross),
  `1`=FILL_OR_KILL, `0`=LIMIT.
- **price** = probability in 1e6 units: `900000` = 0.90. Use
  `probabilityToPrice(0.9)` / `priceToProbability(p)`.
- **quantity / collateral** = 1e6 base units per whole contract (6 decimals).
- **expireTimestampNs** (raw path) is NANOseconds and must be
  `0 < expireNs <= marketExpiryNs()`, else it reverts (`0xd3dea628`).

## Gotchas

- **A PostOnly that would cross REVERTS** with `PostOnlyWouldCross()` and the SDK
  throws — it does not silently rest. Price the order so it can't cross (for a
  SELL, above the best bid), or wrap the call and handle the revert.
- **Markets can span more than one venue.** `MarketCreated` carries no venueId,
  but it does carry the collateral token — scope discovery to the canonical
  collateral (`SOMNIA_TESTNET_ADDRESSES.testUsdc`) so you only trade markets you
  can actually fund.
- **Check status before trading.** An expiry in the future doesn't mean the market
  is open — confirm `getMarketOnchain().status`/`finalized` first.
- **The indexer can be down.** Anything indexer-backed (`loadMarkets`,
  `listBinaryMarkets`, unified `createOrder`) may fail. Discover markets from
  `MarketCreated` chain logs and read state on-chain instead — that path never
  depends on the indexer.
- **Pin SDK ≥ 0.28.1.** Older builds (≤ 0.27) can't be imported by plain `node`
  (`ERR_MODULE_NOT_FOUND: dist/errors`) and need `tsx`; 0.28+ imports under node.
  `tsx` still works and is used here.
- **`loadMarkets()` throws without `wsRpcUrl`** — always pass it.
- **A market only settles after its expiry.** Don't poll `redeem` before then;
  short windows (15min) are easiest for a demo.
- **Scripts don't exit on their own.** The SDK opens a websocket (`wsRpcUrl`) that
  keeps node's event loop alive, so a script hangs after its last line. End with
  `process.exit(0)` once your work is done.

## Somnia gas / tx behavior (not Ethereum)

- **EVM baseline = Cancun** (PUSH0, transient storage, EIP-1559), **plus EIP-7702**
  account delegation. Pin `evm_version = "cancun"` in Foundry.
- **State-creation is priced aggressively.** Paying a never-funded address, first
  writes to fresh storage, and deploys cost far more than on Ethereum — a
  21k-pinned transfer can mine with status 0 and burn the limit. **Estimate gas;
  don't hard-code Ethereum numbers.**
- **EIP-1559 priority-tip floor.** The min base fee is ~6 gwei; if
  `priorityFee + baseFee > maxFeePerGas` (or priority exceeds the gas cap) the tx
  is rejected. Set `maxFeePerGas` with real headroom.
- **If you use EIP-7702** (type-4): there's a ~1.19M-gas intrinsic floor (below it
  fails as `invalid transaction 0x08`), and deploys are ~20× inflated — use a high
  deploy gas limit.

## Where to go for more (public sources only)

- DreamDEX Event Contracts docs: https://docs.dreamdex.io/developers/event-contracts
- DreamDEX Bot Kit: https://github.com/somnia-chain/dreamdex-bot-kit
- Somnia network docs: https://docs.somnia.network
- Somnia gas differences: https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum
