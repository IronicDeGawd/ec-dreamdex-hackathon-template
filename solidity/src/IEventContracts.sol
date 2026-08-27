// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DreamDEX Event Contracts — on-chain interfaces
/// @notice The raw ABI for a binary (Up/Down) prediction-market pool on Somnia.
///         Getting these signatures right is the hard part of the low-level path;
///         once you have them, calling from Solidity/viem/ethers is mechanical.
///
///         Verified against Somnia Shannon testnet. The one struct to double-check
///         against the live ABI before you rely on it is `OrderBookLevel` (marked
///         below) — everything else is confirmed.

/// @dev One resting price level returned by getBookLevels. Field layout is the
///      standard CLOB shape; CONFIRM against the deployed pool's ABI before use.
struct OrderBookLevel {
    uint256 price;      // probability in 1e6 units (900000 = 0.90)
    uint256 quantity;   // total size resting at this level
}

struct BinaryPoolParams {
    address collateralToken;
    address market;             // the per-window market contract (carries the outcome)
    address outcomeToken;       // ERC-6909 singleton holding every market's Up/Down
    uint256 yesId;              // token id for the Up outcome
    uint256 noId;               // token id for the Down outcome
    uint256 oneCollateral;      // 1e6 on testnet — one whole contract
    uint256 setBacking;
    address feeRecipient;
    uint256 makerFeeBpsTimes1k;
    uint256 takerFeeBpsTimes1k;
    uint256 maxBuilderFeeBpsTimes1k;
    uint256 settlementFeeBpsTimes1k;
    address settlement;
    uint64  marketNonce;
    bool    finalized;
}

struct OrderBookParams {
    uint256 tickSize;
    uint256 minQuantity;
    uint256 lotSize;
}

/// @notice The pool: this is where trading happens.
interface IBinaryPool {
    /// @param kind 0=BUY_YES 1=SELL_YES 2=BUY_NO 3=SELL_NO
    /// @param price probability in 1e6 units (900000 = 0.90)
    /// @param orderType 0=LIMIT 1=FILL_OR_KILL 2=IOC 3=POST_ONLY
    /// @param expireTimestampNs order expiry in NANOseconds; must satisfy
    ///        0 < expireTimestampNs <= marketExpiryNs() or it reverts (0xd3dea628).
    /// @dev A POST_ONLY order that would cross the book is dropped: returns
    ///      success=true with orderId=0. Always check the returned orderId.
    function placeBinaryOrder(
        uint8   kind,
        uint256 price,
        uint256 quantity,
        uint64  expireTimestampNs,
        uint8   orderType,
        uint8   selfMatchingOption,
        address builder,
        uint96  builderFeeBpsTimes1k,
        uint64  userData
    ) external returns (bool success, uint128 orderId);

    function cancelOrder(uint128 orderId) external;

    function getBookLevels(bool isBid, uint64 numLevels) external view returns (OrderBookLevel[] memory);
    function getBinaryPoolParams() external view returns (BinaryPoolParams memory);
    function getOrderBookParameters() external view returns (OrderBookParams memory);
    function marketExpiryNs() external view returns (uint64);
    function finalized() external view returns (bool);

    // Collateral is deposited into the pool, then traded against your balance.
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;
    function getWithdrawableBalance(address user, address token) external view returns (uint256);
}

/// @notice The per-window market contract that carries the settlement outcome.
interface IBinaryMarket {
    function isResolved() external view returns (bool);
    function isVoided() external view returns (bool);
    /// @dev One entry per outcome; index 0 = Up. One-hot when resolved,
    ///      equal halves when voided. Winner = the index with the nonzero entry.
    function payoutNumerators() external view returns (uint256[] memory);
}

/// @notice The registry you claim a settled position through. Trading is at the
///         pool; claiming is HERE. It identifies a market by `marketId`, which is
///         published only in the MarketCreated log — not in getBinaryPoolParams —
///         so you must capture it at discovery time. operatorId + venueId likewise
///         come from the market's creation config.
interface IBinaryMarketsModule {
    /// @param outcomeIdx 0 = Up, 1 = Down.
    function redeem(
        uint32  operatorId,
        bytes32 venueId,
        bytes32 marketId,
        uint8   outcomeIdx,
        uint256 amount
    ) external;
}

/// @notice ERC-6909 singleton holding every market's Up/Down as token ids.
interface IOutcomeToken6909 {
    function balanceOf(address owner, uint256 id) external view returns (uint256);
    function isOperator(address owner, address spender) external view returns (bool);
    function setOperator(address spender, bool approved) external returns (bool);
}

/// @notice The collateral token (testnet tUSDC / mainnet USDso). Get testnet
///         tokens from the faucet group: https://t.me/+XHq0F0JXMyhmMzM0
interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
