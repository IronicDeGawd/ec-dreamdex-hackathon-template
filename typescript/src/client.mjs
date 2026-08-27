// Shared setup: builds the SDK exchange object + a plain viem client from .env.
// Every other script imports from here so the config lives in one place.
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { createPublicClient, http } from "viem";
import { somniaTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "dotenv";

// Load the .env at the repo root, regardless of where the script is run from.
config({ path: new URL("../../.env", import.meta.url) });

const { PRIVATE_KEY, RPC_URL, WS_RPC_URL, INDEXER_URL } = process.env;

if (!PRIVATE_KEY || PRIVATE_KEY === "0x...") {
  throw new Error("Set PRIVATE_KEY in .env (a funded Shannon testnet key).");
}
if (!INDEXER_URL) {
  // The SDK requires an indexer URL at construction. Every read/write in this
  // starter is on-chain, so the value is never actually called here — but you
  // must supply one. Get the endpoint from the DreamDEX docs (or use your own).
  throw new Error("Set INDEXER_URL in .env — see https://docs.dreamdex.io/developers/event-contracts");
}

// Your address, derived from the key. Used to read your own balances/orders.
export const me = privateKeyToAccount(PRIVATE_KEY).address;

// Canonical testnet collateral — used to scope market discovery to the venue
// whose tokens you can actually get (see discover.mjs).
export const COLLATERAL = SOMNIA_TESTNET_ADDRESSES.testUsdc;

// A read-only chain client for raw log/state reads the SDK does not cover.
export const pub = createPublicClient({
  chain: somniaTestnet,
  transport: http(RPC_URL || undefined),
});

// The SDK exchange object. `ex.client` = reads, `ex.trader` = writes.
// wsRpcUrl is REQUIRED — loadMarkets() throws without it.
export const ex = new SomniaMarkets({
  chain: somniaTestnet,
  addresses: SOMNIA_TESTNET_ADDRESSES,
  privateKey: PRIVATE_KEY,
  wsRpcUrl: WS_RPC_URL || "wss://api.infra.testnet.somnia.network/ws",
  indexerUrl: INDEXER_URL,
});

// One whole contract = 1e6 base units (testnet collateral is 6-decimals).
export const ONE = 1_000_000n;
