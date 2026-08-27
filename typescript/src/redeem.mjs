// Claim the winning side after a market resolves. Reads market.json written by
// lifecycle.mjs, waits for the window to settle, then redeems 1:1 for collateral.
//
//   winning outcome tokens  ->  collateral   (losing tokens are worth 0)
//
// Run:  npm run redeem
import { readFileSync } from "fs";
import { ex, pub, me } from "./client.mjs";

const m = JSON.parse(readFileSync("market.json", "utf8"));

// The market address + resolution outcome live on the pool / market contract.
// We read them raw so we do not depend on the indexer being up.
const poolAbi = [
  {
    type: "function",
    name: "getBinaryPoolParams",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "collateralToken", type: "address" },
          { name: "market", type: "address" },
          { name: "outcomeToken", type: "address" },
          { name: "yesId", type: "uint256" },
          { name: "noId", type: "uint256" },
          { name: "oneCollateral", type: "uint256" },
          { name: "setBacking", type: "uint256" },
          { name: "feeRecipient", type: "address" },
          { name: "makerFeeBpsTimes1k", type: "uint256" },
          { name: "takerFeeBpsTimes1k", type: "uint256" },
          { name: "maxBuilderFeeBpsTimes1k", type: "uint256" },
          { name: "settlementFeeBpsTimes1k", type: "uint256" },
          { name: "settlement", type: "address" },
          { name: "marketNonce", type: "uint64" },
          { name: "finalized", type: "bool" },
        ],
      },
    ],
  },
];
const marketAbi = [
  { type: "function", name: "isResolved", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "payoutNumerators", stateMutability: "view", inputs: [], outputs: [{ type: "uint256[]" }] },
];

const params = await pub.readContract({ address: m.pool, abi: poolAbi, functionName: "getBinaryPoolParams" });
const marketAddr = params.market;

// Poll until the market resolves (it can only settle after its expiry).
console.log("Waiting for the market to resolve...");
let resolved = false;
while (!resolved) {
  resolved = await pub.readContract({ address: marketAddr, abi: marketAbi, functionName: "isResolved" });
  if (!resolved) {
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 20_000));
  }
}

// One-hot payout when resolved: the winning outcome index has the nonzero entry.
const payouts = await pub.readContract({ address: marketAddr, abi: marketAbi, functionName: "payoutNumerators" });
const winner = payouts.findIndex((p) => p > 0n); // 0 = Up, 1 = Down
const winningId = winner === 0 ? BigInt(m.yesId) : BigInt(m.noId);
console.log(`\nResolved. Winning side: ${winner === 0 ? "Up" : "Down"}`);

// Redeem everything you hold of the winning side.
const amount = await ex.client.getOutcomeBalance({ outcomeToken: m.outcomeToken, account: me, id: winningId });
if (amount === 0n) {
  console.log("You hold none of the winning side — nothing to redeem.");
  process.exit(0);
}
const r = await ex.trader.redeem({ marketId: m.marketId, amount, outcomeIdx: winner, market: marketAddr });
console.log(`redeem   ${r.hash}  claimed ${Number(amount) / 1e6} collateral`);

// The SDK holds a websocket open, so node won't exit on its own — force it.
process.exit(0);
