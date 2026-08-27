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
import { pub } from "./client.mjs";

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

// Keep only markets that have not expired yet.
const live = found
  .filter((m) => Number(m.expiry) > now)
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
