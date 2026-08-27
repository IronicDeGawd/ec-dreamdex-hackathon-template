# Solidity path — talk to the pool directly

The low-level path: no SDK, just the on-chain ABI. The real value here is
[`src/IEventContracts.sol`](src/IEventContracts.sol) — the exact, verified
interface for a binary pool. Drop it into any Foundry/Hardhat project and you can
call Event Contracts from your own contracts or scripts.

> When to use this path: you are writing an on-chain strategy, a router, or a
> contract that itself trades. If you just want an app or agent off-chain, the
> [TypeScript path](../typescript) is the faster baseline.

## Setup

```bash
forge init --no-git .          # if this isn't already a foundry project
forge install foundry-rs/forge-std
cp ../.env.example .env         # fill PRIVATE_KEY + POOL (see below)
```

## Where the config comes from

Every value below is published in the `MarketCreated` log — run
[`../typescript/src/discover.mjs`](../typescript/src/discover.mjs) to read them:

| Env var | Meaning |
|---|---|
| `POOL` | The binary pool address (trading happens here) |
| `MARKET_ID` | `bytes32` market id (needed to redeem) |
| `MARKETS_MODULE` | The registry you redeem through |
| `OPERATOR_ID`, `VENUE_ID` | Market creation config, needed to redeem |

`collateralToken`, `market`, `outcomeToken`, and the Up/Down token ids are all
read back on-chain via `getBinaryPoolParams()` — no need to configure them.

## Run

```bash
forge script script/Lifecycle.s.sol --sig "trade()"  --broadcast --rpc-url somnia_testnet
# after the window expires:
forge script script/Lifecycle.s.sol --sig "redeem()" --broadcast --rpc-url somnia_testnet
```

## Order encoding

`placeBinaryOrder(kind, price, quantity, expireNs, orderType, ...)`

- **kind**: `0`=BUY_YES `1`=SELL_YES `2`=BUY_NO `3`=SELL_NO ("YES" = Up).
- **orderType**: `0`=LIMIT `1`=FILL_OR_KILL `2`=IOC `3`=POST_ONLY.
- **price**: probability in 1e6 units — `900000` = 0.90.
- **expireNs**: NANOseconds, and must be `<= marketExpiryNs()` or it reverts.
- A **POST_ONLY order that would cross is dropped** — `success=true`, `orderId=0`.

Somnia gas is not Ethereum gas — read the root `SKILL.md` before you tune limits.
