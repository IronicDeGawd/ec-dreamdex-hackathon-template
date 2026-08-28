// Find live binary markets by scanning `MarketCreated` logs directly from the
// chain. This deliberately does NOT rely on the indexer — if the indexer is
// down you can still discover everything you need. (The indexer path is
// `ex.client.listBinaryMarkets({})` if you prefer it.)
//
// Run:  npm run discover
// Deep import: the SDK doesn't re-export this ABI from its main entry, so we
// reach into dist directly (relative to node_modules, resolved from the package
// root where `npm run` sets the cwd).
import { marketCreatorEventsAbi } from "../node_modules/@somnia-chain/markets-sdk/dist/eventsAbi.js";
import { pub, COLLATERAL } from "./client.mjs";

const marketCreated = marketCreatorEventsAbi.find((e) => e.name === "MarketCreated");
const now = Math.floor(Date.now() / 1000);

// Somnia caps getLogs at 1000 blocks per call, so walk backwards in windows.
const head = await pub.getBlockNumber();
const found = [];
for (let i = 0; i < 40; i++) {
  const to = head - BigInt(i * 1000);
  try {
    const logs = await pub.getLogs({ event: marketCreated, fromBlock: to - 999n, toBlock: to });
    found.push(...logs.map((l) => l.args));
  } catch {
    // window failed (rate limit / reorg) — keep going, this is best-effort.
  }
}

// Keep markets that (a) haven't expired and (b) settle in the collateral you can
// actually get from the faucet (tUSDC). MarketCreated carries no venueId, so this
// scopes by collateral, not venue — it filters to markets you can fund, not to a
// single venue. On testnet every live market is on the DreamDEX venue and shares
// this collateral, so that's enough today.
const live = found
  .filter((m) => Number(m.expiry) > now && m.collateral?.toLowerCase() === COLLATERAL.toLowerCase())
  .sort((a, b) => Number(a.expiry) - Number(b.expiry));

console.log(`Found ${found.length} MarketCreated events, ${live.length} still live.\n`);
for (const m of live) {
  const mins = Math.round((Number(m.expiry) - now) / 60);
  console.log(
    `${m.asset.padEnd(4)}  window=${Number(m.intervalSec) / 60}min  ` +
      `expires in ${mins}min  pool=${m.pool}  marketId=${m.marketId}`
  );
}

console.log(
  "\nPick a pool + marketId above and pass them to lifecycle.mjs " +
    "(shorter windows resolve sooner, which is handy for a demo)."
);
