// Solana Program Configuration
// ⚠️  THESE VALUES ARE TAKEN DIRECTLY FROM YOUR DEPLOYED IDL & RUST SOURCE
//     DO NOT change them unless you redeploy the program.

// ── Program addresses ────────────────────────────────────────────────────────

/** The deployed Anchor program on Devnet */
export const PROGRAM_ID = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";

/** Must match AUTHORITY_PUBKEY constant in lib.rs */
export const AUTHORITY_PUBKEY = "Ec7XfHbeDw1YmHzcGo3WrK73QnqQ3GL9VBczYGPCQJha";

/** Must match PLATFORM_WALLET_PUBKEY constant in lib.rs */
export const PLATFORM_WALLET_PUBKEY = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";

// ── Network ──────────────────────────────────────────────────────────────────

export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
export const SOLANA_NETWORK: "devnet" | "mainnet-beta" = "devnet";

// ── Fee config ───────────────────────────────────────────────────────────────

/** 10% total platform fee (1000 bps out of 10,000) — micro tier only, kept for reference */
export const PLATFORM_FEE_BPS = 1000;             // micro tier only — kept for reference
export const PLATFORM_FEE_PERCENT = 10;            // micro tier only — kept for reference

/** Moderator gets 30% of the platform fee — was 40%, updated to 30% */
export const MODERATOR_FEE_SHARE_PERCENT = 30;     // was 40 — updated to 30%
export const MODERATOR_FEE_CAP_USD = 10;           // new — hard cap in USD

// ── Wager timing ─────────────────────────────────────────────────────────────

/** How long a created wager waits for player B before expiring (7 days) */
export const WAGER_JOIN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/** Retract window after both votes agree — matches RETRACT_WINDOW_SECONDS in lib.rs (15s for testing) */
export const RETRACT_WINDOW_SECONDS = 15;

/** Ready-room countdown before the game link is shared */
export const READY_ROOM_COUNTDOWN_SECONDS = 10;

/** How long a moderator popup stays before auto-rejecting and moving to next person */
export const MODERATOR_POPUP_SECONDS = 30;

// ── On-chain wager status (mirrors WagerStatus enum in lib.rs) ────────────────

export const WagerStatusOnChain = {
  Created: 0,
  Joined: 1,
  Voting: 2,
  Retractable: 3,
  Disputed: 4,
  Closed: 5,
  Resolved: 6,
} as const;

// ── IDL instruction discriminators (copy-pasted from gamegambit.json) ─────────
// These are the first 8 bytes of sha256("global:<instruction_name>").
// If you ever redeploy the program they MUST be updated from the new IDL.

export const INSTRUCTION_DISCRIMINATORS: Record<string, readonly number[]> = {
  initialize_player: [79, 249, 88, 177, 220, 62, 56, 128],
  ban_player: [20, 123, 183, 191, 29, 55, 244, 21],
  create_wager: [210, 82, 178, 75, 253, 34, 84, 120],
  join_wager: [119, 81, 120, 160, 80, 8, 75, 239],
  submit_vote: [115, 242, 100, 0, 49, 178, 242, 133],
  retract_vote: [227, 0, 85, 234, 243, 42, 133, 162],
  resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
  close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
};

// ── IDL account discriminators ────────────────────────────────────────────────

export const ACCOUNT_DISCRIMINATORS = {
  PlayerProfile: [82, 226, 99, 87, 164, 130, 181, 80],
  WagerAccount: [43, 206, 233, 140, 104, 50, 20, 243],
} as const;

// ── IDL event discriminators ──────────────────────────────────────────────────

export const EVENT_DISCRIMINATORS = {
  PlayerBanned: [164, 0, 117, 147, 4, 138, 149, 196],
  VoteRetracted: [48, 194, 255, 216, 156, 13, 121, 241],
  VoteSubmitted: [21, 54, 43, 190, 87, 214, 250, 218],
  WagerClosed: [157, 212, 28, 112, 6, 143, 187, 185],
  WagerCreated: [177, 41, 34, 111, 170, 96, 157, 62],
  WagerJoined: [74, 213, 37, 114, 201, 144, 6, 12],
  WagerResolved: [166, 83, 14, 127, 130, 175, 204, 13],
} as const;

// ── Explorer URL helpers ──────────────────────────────────────────────────────

export const getExplorerUrl = (
  type: "tx" | "address",
  value: string,
  cluster: "devnet" | "mainnet-beta" = SOLANA_NETWORK
) => `https://explorer.solana.com/${type}/${value}?cluster=${cluster}`;

export const getProgramExplorerUrl = () => getExplorerUrl("address", PROGRAM_ID);
export const getAuthorityExplorerUrl = () => getExplorerUrl("address", AUTHORITY_PUBKEY);
export const getTxExplorerUrl = (sig: string) => getExplorerUrl("tx", sig);