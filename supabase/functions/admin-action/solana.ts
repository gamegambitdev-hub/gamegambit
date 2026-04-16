// supabase/functions/admin-action/solana.ts
//
// FIX: Replaced static top-level `import * as web3 from "https://esm.sh/@solana/web3.js"`
// with a lazy dynamic import (same pattern as secure-wager/solana.ts and process-verdict).
//
// Root cause of CPU timeout: the static import forced Deno to download and parse the
// entire ~2 MB @solana/web3.js bundle at cold-start, exhausting the CPU budget before
// the function could handle a single request. The lazy pattern defers that cost to the
// first actual Solana call, after cold-start is already complete.

export const PROGRAM_ID_STR = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
export const PLATFORM_WALLET_STR = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";

// ── Fee helper ────────────────────────────────────────────────────────────────
const MICRO_THRESHOLD = 500_000_000;
const WHALE_THRESHOLD = 5_000_000_000;

export function calculatePlatformFee(stakeLamports: number): number {
    let bps: number;
    if (stakeLamports < MICRO_THRESHOLD) bps = 1000;
    else if (stakeLamports <= WHALE_THRESHOLD) bps = 700;
    else bps = 500;
    return Math.floor((stakeLamports * 2 * bps) / 10_000);
}

export const DISCRIMINATORS = {
    resolve_wager: new Uint8Array([31, 179, 1, 228, 83, 224, 1, 123]),
    close_wager: new Uint8Array([167, 240, 85, 147, 127, 50, 69, 203]),
};

// ── Lazy Solana import ────────────────────────────────────────────────────────
// Matches the pattern used in secure-wager/solana.ts and process-verdict/index.ts.
// Dynamic import defers bundle parsing to first use, keeping cold-start CPU cheap.
let _solana: typeof import("https://esm.sh/@solana/web3.js@1.98.0") | null = null;

export async function getSolana() {
    if (!_solana) {
        _solana = await import("https://esm.sh/@solana/web3.js@1.98.0");
    }
    return _solana;
}

// ── Keypair ───────────────────────────────────────────────────────────────────
export async function getAuthority() {
    const { Keypair } = await getSolana();
    const raw = Deno.env.get("AUTHORITY_WALLET_SECRET");
    if (!raw) throw new Error("AUTHORITY_WALLET_SECRET is not set");
    let bytes: number[];
    try { bytes = JSON.parse(raw); }
    catch { throw new Error("AUTHORITY_WALLET_SECRET is not valid JSON"); }
    return Keypair.fromSecretKey(new Uint8Array(bytes));
}

// ── PDA derivation ────────────────────────────────────────────────────────────
export async function deriveWagerPDA(playerAWallet: string, matchId: bigint) {
    const { PublicKey } = await getSolana();
    const matchIdBytes = new Uint8Array(8);
    new DataView(matchIdBytes.buffer).setBigUint64(0, matchId, true);
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), new PublicKey(playerAWallet).toBytes(), matchIdBytes],
        new PublicKey(PROGRAM_ID_STR),
    );
    return pda;
}

// ── Send + confirm ────────────────────────────────────────────────────────────
export async function sendAndConfirm(
    // deno-lint-ignore no-explicit-any
    authority: any,
    // deno-lint-ignore no-explicit-any
    instruction: any,
    rpcUrl: string,
): Promise<string> {
    const { Connection, Transaction } = await getSolana();
    const connection = new Connection(rpcUrl, "confirmed");
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction();
    tx.add(instruction);
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority.publicKey;
    tx.sign(authority);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
    });

    await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
    );

    return signature;
}