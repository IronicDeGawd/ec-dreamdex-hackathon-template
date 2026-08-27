// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import {
    IBinaryPool,
    IBinaryMarket,
    IBinaryMarketsModule,
    IOutcomeToken6909,
    IERC20Like,
    BinaryPoolParams
} from "../src/IEventContracts.sol";

/// @title Raw Event Contract lifecycle — reference template
/// @notice Shows the exact on-chain call sequence. Config comes from env vars so
///         nothing is hard-coded. This is the LOW-LEVEL path; the TypeScript SDK
///         path wires the same flow end-to-end if you want a running baseline.
///
///   trade:   forge script script/Lifecycle.s.sol --sig "trade()"  --broadcast --rpc-url $RPC_URL
///   redeem:  forge script script/Lifecycle.s.sol --sig "redeem()" --broadcast --rpc-url $RPC_URL
///
/// Required env (get POOL/MARKET_ID/OPERATOR_ID/VENUE_ID from the MarketCreated
/// log — see ../../typescript/src/discover.mjs):
///   PRIVATE_KEY, POOL,
///   redeem also needs: MARKETS_MODULE, MARKET_ID, OPERATOR_ID, VENUE_ID
contract Lifecycle is Script {
    function trade() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        IBinaryPool pool = IBinaryPool(vm.envAddress("POOL"));
        vm.startBroadcast(pk);

        BinaryPoolParams memory p = pool.getBinaryPoolParams();
        IERC20Like collateral = IERC20Like(p.collateralToken);

        // Fund the wallet with testnet tUSDC (+ STT for gas) first — get testnet
        // tokens from the SomniaHacks dev group (use the faucet topic): https://t.me/+XHq0F0JXMyhmMzM0

        // 1. deposit collateral into the pool so you can trade against it
        collateral.approve(address(pool), type(uint256).max);
        pool.deposit(p.collateralToken, 100 * p.oneCollateral);

        // 2. place a taker BUY_YES (kind=0) as IOC (orderType=2), up to 0.99.
        //    Fills only if someone is resting on the ask — otherwise it no-ops.
        //    Expiry must be <= the market expiry, expressed in NANOseconds.
        (bool ok, uint128 orderId) = pool.placeBinaryOrder(
            0,                       // kind: BUY_YES
            990_000,                 // price: 0.99 in 1e6 units
            1 * p.oneCollateral,     // quantity: 1 contract
            pool.marketExpiryNs(),   // expireTimestampNs
            2,                       // orderType: IOC (taker)
            0,                       // selfMatchingOption
            address(0),              // builder
            0,                       // builderFeeBpsTimes1k
            0                        // userData
        );
        console2.log("placed ok=%s orderId=%s", ok, uint256(orderId));

        // To hold inventory without a counterparty you mint a set (1 collateral
        // -> 1 Up + 1 Down). That entrypoint is exercised in the SDK path
        // (`ex.trader.mintSet`) — wiring it here is left to you.

        vm.stopBroadcast();
    }

    function redeem() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        IBinaryPool pool = IBinaryPool(vm.envAddress("POOL"));
        IBinaryMarketsModule module = IBinaryMarketsModule(vm.envAddress("MARKETS_MODULE"));
        bytes32 marketId = vm.envBytes32("MARKET_ID");
        uint32 operatorId = uint32(vm.envUint("OPERATOR_ID"));
        bytes32 venueId = vm.envBytes32("VENUE_ID");

        BinaryPoolParams memory p = pool.getBinaryPoolParams();
        IBinaryMarket market = IBinaryMarket(p.market);
        require(market.isResolved(), "not resolved yet");

        // One-hot payout: the winning outcome index has the nonzero entry.
        uint256[] memory payouts = market.payoutNumerators();
        uint8 winner = payouts[0] > 0 ? 0 : 1; // 0 = Up, 1 = Down
        uint256 winningId = winner == 0 ? p.yesId : p.noId;

        uint256 amount = IOutcomeToken6909(p.outcomeToken).balanceOf(vm.addr(pk), winningId);
        require(amount > 0, "nothing to redeem");

        vm.startBroadcast(pk);
        module.redeem(operatorId, venueId, marketId, winner, amount);
        vm.stopBroadcast();
        console2.log("redeemed %s of outcome %s", amount, uint256(winner));
    }
}
