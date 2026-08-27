// The whole Event Contract lifecycle in one file — this is the PRIMITIVE the
// hackathon is built on. Your app is whatever you wrap around these calls.
//
//   mintSet -> 1 collateral becomes 1 "Up" + 1 "Down" token
//              (fund the wallet with testnet tUSDC + STT first — SomniaHacks dev group (use the faucet topic):
//               https://t.me/+XHq0F0JXMyhmMzM0)
//   place   -> rest a maker order, then cross it with a taker order
//   (later) -> redeem the winning side after the market resolves (redeem.mjs)
//
// Sides:      BUY_YES / SELL_YES / BUY_NO / SELL_NO   ("YES" = Up, "NO" = Down)
// orderType:  3 = PostOnly (maker, must rest)   2 = IOC (taker, must cross)
// price:      probability in 1e6 units — 900000n = 0.90 = "90% chance"
//
// Run:  npm run lifecycle
import { marketCreatorEventsAbi } from "../node_modules/@somnia-chain/markets-sdk/dist/eventsAbi.js";
import { probabilityToPrice } from "@somnia-chain/markets-sdk";
import { writeFileSync } from "fs";
import { ex, pub, me, ONE } from "./client.mjs";

// --- 1. discover the shortest live window (resolves soonest = best for a demo)
const mc = marketCreatorEventsAbi.find((e) => e.name === "MarketCreated");
const now = Math.floor(Date.now() / 1000);
const head = await pub.getBlockNumber();
const all = [];
for (let i = 0; i < 40; i++) {
  const to = head - BigInt(i * 1000);
  try {
    const logs = await pub.getLogs({ event: mc, fromBlock: to - 999n, toBlock: to });
    all.push(...logs.map((l) => l.args));
  } catch {}
}
const market = all
  .filter((m) => Number(m.expiry) > now + 120) // leave a small buffer before expiry
  .sort((a, b) => Number(a.intervalSec) - Number(b.intervalSec) || Number(a.expiry) - Number(b.expiry))[0];
if (!market) throw new Error("No live market found. Try again in a minute.");
const { pool, marketId, asset, expiry } = market;
console.log(`Market: ${asset}  pool=${pool}  expires in ${Math.round((Number(expiry) - now) / 60)}min\n`);

// --- 2. read the market so we know the outcome-token ids
const mo = await ex.client.getMarketOnchain(marketId);
const bal = async () => [
  await ex.client.getOutcomeBalance({ outcomeToken: mo.outcomeToken, account: me, id: BigInt(mo.yesId) }),
  await ex.client.getOutcomeBalance({ outcomeToken: mo.outcomeToken, account: me, id: BigInt(mo.noId) }),
];
const show = (label, [u, d]) => console.log(`${label}  Up=${Number(u) / 1e6}  Down=${Number(d) / 1e6}`);

// --- 3. mint a set: 4 collateral -> 4 Up + 4 Down.
//     Needs testnet tUSDC (+ STT for gas) already in the wallet. Get testnet
//     tokens from the SomniaHacks dev group (use the faucet topic): https://t.me/+XHq0F0JXMyhmMzM0
show("before ", await bal());
let mint;
try {
  mint = await ex.trader.mintSet({ pool, amount: 4n * ONE });
} catch (e) {
  console.error(
    "\nmintSet failed — is the wallet funded with testnet tUSDC + STT?\n" +
      "Get testnet tokens from the SomniaHacks dev group (use the faucet topic): https://t.me/+XHq0F0JXMyhmMzM0\n"
  );
  throw e;
}
console.log(`mintSet  ${mint.hash}`);
show("minted ", await bal());

// --- 4. rest a maker order (PostOnly): sell 2 Up at 0.90
const maker = await ex.trader.placeOrder({
  pool,
  side: "SELL_YES",
  price: probabilityToPrice(0.9),
  quantity: 2n * ONE,
  orderType: 3,
});
console.log(`maker    orderId=${maker.orderId}  (resting SELL Up @ 0.90)`);

// --- 5. cross it with a taker order (IOC): buy 1 Up at up to 0.99
const taker = await ex.trader.placeOrder({
  pool,
  side: "BUY_YES",
  price: probabilityToPrice(0.99),
  quantity: 1n * ONE,
  orderType: 2,
});
const fill = (taker.fills || [])[0];
console.log(`taker    ${fill ? `filled ${Number(fill.quantityFilled) / 1e6} @ ${Number(fill.fillPrice) / 1e6}` : "no fill"}`);

// --- 6. clean up the leftover resting order
if (maker.orderId) {
  const c = await ex.trader.cancelOrder({ pool, orderId: BigInt(maker.orderId) });
  console.log(`cancel   ${c.hash}`);
}
show("after  ", await bal());

// --- 7. save the market so redeem.mjs can claim it after it resolves
writeFileSync(
  "market.json",
  JSON.stringify({ pool, marketId, yesId: String(mo.yesId), noId: String(mo.noId), outcomeToken: mo.outcomeToken, expiry: String(expiry) }, null, 2)
);
console.log(`\nSaved market.json. After the window expires (~${Math.round((Number(expiry) - now) / 60)}min), run:  npm run redeem`);

// The SDK holds a websocket open, so node won't exit on its own — force it.
process.exit(0);
