# DreamDEX Event Contracts — Starter

A minimal, honest starting point for the **Somnia × DreamDEX Event Contracts
Hackathon**. It shows you the primitive — a binary prediction market you can
mint, trade, and settle — working end to end, in two flavors:

- **[`typescript/`](typescript)** — the full lifecycle via `@somnia-chain/markets-sdk`. The fast baseline.
- **[`solidity/`](solidity)** — the raw binary-pool ABI, for on-chain strategies.
- **[`SKILL.md`](SKILL.md)** — a skill for your coding agent (Claude, Cursor): the method surface, the encoding, and the Somnia gas traps in one file.

## This is a Lego brick, not a product

The lifecycle below is the *primitive* every submission stands on. It is
deliberately **not** an app — there's no UI, no strategy, no cleverness. That
part is yours. Copying this repo gets you a working mint→trade→settle loop and
nothing to demo. The interesting 90% — the idea, the experience, the edge — is
what the judges score.

## The primitive

```
  fund ────▶ mintSet ──▶ trade (place / cross orders) ──▶ [window expires] ──▶ redeem
  wallet w/    1 USDC =     buy & sell Up / Down            market resolves     winning
  tUSDC+STT    1 Up+1 Down  on the order book              to Up or Down        side → USDC
```

Fund your wallet with testnet tUSDC (collateral) and STT (gas) from the SomniaHacks dev group (use the faucet topic): **https://t.me/+XHq0F0JXMyhmMzM0**

- **Up / Down** are the two outcome tokens (ERC-6909). One collateral mints one of each.
- **Price = probability**, in millionths: `900000` = 0.90 = "90% chance".
- Winning tokens redeem 1:1 for collateral; losing tokens are worth zero.

## Quick start (TypeScript)

```bash
cd typescript
cp ../.env.example ../.env      # add a funded Shannon testnet key
npm install
npm run discover               # see live markets
npm run lifecycle              # mint -> maker -> taker, prints every step
npm run redeem                 # after the window expires, claim the winner
```

Shannon testnet is **chain 50312**. Get testnet tUSDC + STT from the SomniaHacks dev group (use the faucet topic): **https://t.me/+XHq0F0JXMyhmMzM0**

## Ideas worth building

The lifecycle is trivial; a product people actually use is not. Some directions
that map to what the hackathon rewards (innovation, UX, ecosystem impact):

- **A consumer betting app** — a clean mobile-first UI where anyone can back Up or
  Down in two taps, with live odds and a portfolio view.
- **An AI trading agent** — an agent that reads market conditions and takes
  positions autonomously, with a dashboard showing its reasoning and PnL.
- **Social / group prediction** — leaderboards, shared bets, a Telegram or Farcaster
  bot that lets a community bet together.
- **Analytics & odds tools** — historical resolved-market analytics, implied-probability
  charts, a "sharpest traders" tracker, alerting on mispriced windows.
- **A market maker** — a bot that quotes both sides, earns the spread, and keeps
  the book liquid (great for the ecosystem, hard to do well).
- **A resolver / oracle experience** — surface how and when markets settle, make
  settlement legible and trustworthy to end users.

Pick one, make it real, make it usable. Don't ship the loop below with a logo on it.

## Resources (all public)

- **Event Contracts docs** — https://docs.dreamdex.io/developers/event-contracts
- **DreamDEX Bot Kit** — https://github.com/somnia-chain/dreamdex-bot-kit
- **markets-sdk (npm)** — https://www.npmjs.com/package/@somnia-chain/markets-sdk
- **DreamDEX app (Event Contracts)** — https://app.dreamdex.io/event-contracts
- **Somnia docs** — https://docs.somnia.network
- **Testnet tokens (SomniaHacks dev group — faucet topic)** — https://t.me/+XHq0F0JXMyhmMzM0

## What's verified

The TypeScript flow was run end-to-end on Shannon testnet (mint → maker → taker →
cancel → settle → redeem) with real tx hashes, and the collateral balance
reconciles to the cent. The Solidity interfaces are verified against the deployed
pool; the Foundry script is a reference template you point at a live market. SDK
is pinned to a known-good version — bump it once you've confirmed the newer
method shapes.

## License

MIT. Fork it, gut it, build something better.
