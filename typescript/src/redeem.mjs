// Claim the winning side after a market resolves. Reads market.json written by
// lifecycle.mjs, waits for the window to settle, then redeems 1:1 for collateral.
//
//   winning outcome tokens  ->  collateral   (losing tokens are worth 0)
//
// Everything needed comes from getMarketOnchain — no hand-written ABIs.
// (operatorId/venueId default to 0 / zero-bytes32 = the canonical venue.)
//
// Run:  npm run redeem
import { readFileSync } from "fs";
import { ex, me } from "./client.mjs";

const m = JSON.parse(readFileSync("market.json", "utf8"));

// Poll on-chain status until the market settles (it can only resolve after its
// expiry). status: 0 Listed, 1 Trading, 2 Locked, 3 Settling, 4 Resolved, 5 Voided.
console.log("Waiting for the market to resolve...");
let mo = await ex.client.getMarketOnchain(m.marketId);
while (!mo.finalized && !mo.isResolved && !mo.isVoided) {
  process.stdout.write(".");
  await new Promise((r) => setTimeout(r, 20_000));
  mo = await ex.client.getMarketOnchain(m.marketId);
}

const balOf = (id) => ex.client.getOutcomeBalance({ outcomeToken: mo.outcomeToken, account: me, id: BigInt(id) });

// Voided markets refund BOTH sides at 0.5; resolved markets pay only the winner.
if (mo.isVoided) {
  console.log("\nMarket voided — both sides refund at 0.5.");
  for (const [name, id, idx] of [["Up", m.yesId, 0], ["Down", m.noId, 1]]) {
    const amount = await balOf(id);
    if (amount > 0n) {
      const r = await ex.trader.redeem({ marketId: m.marketId, outcomeIdx: idx, amount });
      console.log(`redeem   ${name}: ${r.hash}  (${Number(amount) / 1e6})`);
    }
  }
} else {
  const winner = Number(mo.winningOutcome); // 0 = Up, 1 = Down
  const amount = await balOf(winner === 0 ? m.yesId : m.noId);
  console.log(`\nResolved. Winning side: ${winner === 0 ? "Up" : "Down"}; you hold ${Number(amount) / 1e6}.`);
  if (amount === 0n) {
    console.log("You hold none of the winning side — nothing to redeem.");
  } else {
    const r = await ex.trader.redeem({ marketId: m.marketId, outcomeIdx: winner, amount });
    console.log(`redeem   ${r.hash}  claimed ${Number(amount) / 1e6} collateral`);
  }
}

// The SDK holds a websocket open, so node won't exit on its own — force it.
process.exit(0);
