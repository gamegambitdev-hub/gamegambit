import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    sendAndConfirmTransaction,
} from "https://esm.sh/@solana/web3.js@1.98.0";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROGRAM_ID = new PublicKey("E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR");
const PLATFORM_WALLET = new PublicKey("3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY");

// Read from env — falls back to devnet so local testing still works,
// but mainnet deploys will pick up the correct RPC via the secret.
const RPC_URL = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com";
const IS_DEVNET = RPC_URL.includes("devnet");

const ADMIN_WALLET = Deno.env.get("ADMIN_WALLET") ?? "";

const DISCRIMINATORS = {
    resolve_wager: new Uint8Array([31, 179, 1, 228, 83, 224, 1, 123]),
    close_wager: new Uint8Array([167, 240, 85, 147, 127, 50, 69, 203]),
};

function getSupabase() {
    return createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
}

function getAuthority(): Keypair {
    const raw = Deno.env.get("AUTHORITY_WALLET_SECRET")!;
    const bytes = JSON.parse(raw);
    return Keypair.fromSecretKey(new Uint8Array(bytes));
}

function deriveWagerPDA(playerAWallet: string, matchId: bigint): PublicKey {
    const playerAPubkey = new PublicKey(playerAWallet);
    const matchIdBytes = new Uint8Array(8);
    const view = new DataView(matchIdBytes.buffer);
    view.setBigUint64(0, matchId, true);
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), playerAPubkey.toBytes(), matchIdBytes],
        PROGRAM_ID
    );
    return pda;
}

// IDL: resolve_wager accounts → wager, winner, authorizer (signer), platform_wallet, system_program
function buildResolveWagerIx(
    wagerPDA: PublicKey,
    authority: PublicKey,
    winner: PublicKey,
): TransactionInstruction {
    const disc = DISCRIMINATORS.resolve_wager;
    const winnerBytes = winner.toBytes();
    const instructionData = new Uint8Array(disc.length + winnerBytes.length);
    instructionData.set(disc, 0);
    instructionData.set(winnerBytes, disc.length);

    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: wagerPDA, isSigner: false, isWritable: true },
            { pubkey: winner, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: true, isWritable: true },
            { pubkey: PLATFORM_WALLET, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: instructionData,
    });
}

// IDL: close_wager accounts → wager, player_a, player_b, authorizer (signer), system_program
// No platform_wallet — close_wager splits funds back to both players only.
function buildCloseWagerIx(
    wagerPDA: PublicKey,
    authority: PublicKey,
    playerA: PublicKey,
    playerB: PublicKey,
): TransactionInstruction {
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: wagerPDA, isSigner: false, isWritable: true },
            { pubkey: playerA, isSigner: false, isWritable: true },
            { pubkey: playerB, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: DISCRIMINATORS.close_wager,
    });
}

function explorerTx(sig: string): string {
    return `https://explorer.solana.com/tx/${sig}${IS_DEVNET ? "?cluster=devnet" : ""}`;
}

function explorerAddress(address: string): string {
    return `https://explorer.solana.com/address/${address}${IS_DEVNET ? "?cluster=devnet" : ""}`;
}

async function logAdminAction(
    supabase: ReturnType<typeof getSupabase>,
    action: string,
    wagerId: string | null,
    walletAddress: string | null,
    performedBy: string,
    notes: string | null,
    metadata: Record<string, unknown> = {}
) {
    await supabase.from("admin_logs").insert({
        action,
        wager_id: wagerId,
        wallet_address: walletAddress,
        performed_by: performedBy,
        notes,
        metadata,
    });
}

async function forceResolve(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string,
    winnerWallet: string,
    adminWallet: string,
    notes: string | null
) {
    const { data: wager, error } = await supabase
        .from("wagers")
        .select("*")
        .eq("id", wagerId)
        .single();

    if (error || !wager) throw new Error("Wager not found");

    if (winnerWallet !== wager.player_a_wallet && winnerWallet !== wager.player_b_wallet) {
        throw new Error("Winner must be a participant in this wager");
    }

    if (!["voting", "joined", "disputed", "retractable"].includes(wager.status)) {
        throw new Error(`Cannot resolve wager with status: ${wager.status}`);
    }

    // Atomic guard — only succeeds once, prevents double-pay on admin double-click
    const { data: updatedWager, error: updateError } = await supabase
        .from("wagers")
        .update({
            status: "resolved",
            winner_wallet: winnerWallet,
            resolved_at: new Date().toISOString(),
        })
        .eq("id", wagerId)
        .in("status", ["voting", "joined", "disputed", "retractable"])
        .select()
        .single();

    if (updateError || !updatedWager) {
        throw new Error("Wager already resolved or status changed — aborting to prevent double-pay");
    }

    const authority = getAuthority();
    const connection = new Connection(RPC_URL, "confirmed");
    const wagerPDA = deriveWagerPDA(wager.player_a_wallet, BigInt(wager.match_id));
    const winnerPubkey = new PublicKey(winnerWallet);

    const ix = buildResolveWagerIx(wagerPDA, authority.publicKey, winnerPubkey);
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [authority], { commitment: "confirmed" });

    const totalPot = wager.stake_lamports * 2;
    const platformFee = Math.floor(totalPot * 0.1);
    const winnerPayout = totalPot - platformFee;

    const { error: txInsertError } = await supabase.from("wager_transactions").upsert([
        { wager_id: wagerId, wallet_address: winnerWallet, tx_type: "winner_payout", amount_lamports: winnerPayout, tx_signature: sig, status: "confirmed" },
        { wager_id: wagerId, wallet_address: PLATFORM_WALLET.toBase58(), tx_type: "platform_fee", amount_lamports: platformFee, tx_signature: sig, status: "confirmed" },
    ], { onConflict: "tx_signature", ignoreDuplicates: true });

    if (txInsertError) {
        console.error("[admin-action] forceResolve wager_transactions upsert failed:", JSON.stringify(txInsertError));
    }

    await logAdminAction(supabase, "force_resolve", wagerId, winnerWallet, adminWallet, notes, {
        tx_signature: sig,
        winner: winnerWallet,
        payout_lamports: winnerPayout,
    });

    return {
        success: true,
        txSignature: sig,
        explorerUrl: explorerTx(sig),
        winnerWallet,
        payoutLamports: winnerPayout,
    };
}

async function forceRefund(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string,
    adminWallet: string,
    notes: string | null
) {
    const { data: wager, error } = await supabase
        .from("wagers")
        .select("*")
        .eq("id", wagerId)
        .single();

    if (error || !wager) throw new Error("Wager not found");

    if (!["voting", "joined", "disputed", "retractable"].includes(wager.status)) {
        throw new Error(`Cannot refund wager with status: ${wager.status}`);
    }

    if (!wager.player_b_wallet) throw new Error("Cannot refund single-player wager");

    // Atomic guard — only succeeds once, prevents double-refund on admin double-click
    const { data: updatedWager, error: updateError } = await supabase
        .from("wagers")
        .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancel_reason: "admin_force_refund",
        })
        .eq("id", wagerId)
        .in("status", ["voting", "joined", "disputed", "retractable"])
        .select()
        .single();

    if (updateError || !updatedWager) {
        throw new Error("Wager already cancelled or status changed — aborting to prevent double-refund");
    }

    const authority = getAuthority();
    const connection = new Connection(RPC_URL, "confirmed");
    const wagerPDA = deriveWagerPDA(wager.player_a_wallet, BigInt(wager.match_id));

    const pdaBalance = await connection.getBalance(wagerPDA);
    if (pdaBalance === 0) throw new Error("PDA is empty — funds may have already been distributed");

    const playerAPubkey = new PublicKey(wager.player_a_wallet);
    const playerBPubkey = new PublicKey(wager.player_b_wallet);

    const ix = buildCloseWagerIx(wagerPDA, authority.publicKey, playerAPubkey, playerBPubkey);
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [authority], { commitment: "confirmed" });

    const { error: txInsertError } = await supabase.from("wager_transactions").upsert([
        { wager_id: wagerId, wallet_address: wager.player_a_wallet, tx_type: "cancel_refund", amount_lamports: wager.stake_lamports, tx_signature: sig, status: "confirmed" },
        { wager_id: wagerId, wallet_address: wager.player_b_wallet, tx_type: "cancel_refund", amount_lamports: wager.stake_lamports, tx_signature: sig, status: "confirmed" },
    ], { onConflict: "tx_signature", ignoreDuplicates: true });

    if (txInsertError) {
        console.error("[admin-action] forceRefund wager_transactions upsert failed:", JSON.stringify(txInsertError));
    }

    await logAdminAction(supabase, "force_refund", wagerId, null, adminWallet, notes, {
        tx_signature: sig,
        refund_lamports: wager.stake_lamports,
    });

    return {
        success: true,
        txSignature: sig,
        explorerUrl: explorerTx(sig),
        refundLamports: wager.stake_lamports,
    };
}

async function markDisputed(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string,
    adminWallet: string,
    notes: string | null
) {
    const { error } = await supabase
        .from("wagers")
        .update({ status: "disputed", requires_moderator: true })
        .eq("id", wagerId);

    if (error) throw new Error("Failed to mark as disputed");

    await logAdminAction(supabase, "mark_disputed", wagerId, null, adminWallet, notes);
    return { success: true };
}

async function banPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string,
    reason: string,
    adminWallet: string
) {
    const { error } = await supabase
        .from("players")
        .update({ is_banned: true, ban_reason: reason })
        .eq("wallet_address", walletAddress);

    if (error) throw new Error("Failed to ban player");

    await logAdminAction(supabase, "ban_player", null, walletAddress, adminWallet, reason);
    return { success: true };
}

async function unbanPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string,
    adminWallet: string
) {
    const { error } = await supabase
        .from("players")
        .update({ is_banned: false, ban_reason: null })
        .eq("wallet_address", walletAddress);

    if (error) throw new Error("Failed to unban player");

    await logAdminAction(supabase, "unban_player", null, walletAddress, adminWallet, null);
    return { success: true };
}

async function flagPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string,
    reason: string,
    adminWallet: string
) {
    const { error } = await supabase
        .from("players")
        .update({
            flagged_for_review: true,
            flag_reason: reason,
            flagged_at: new Date().toISOString(),
            flagged_by: adminWallet,
        })
        .eq("wallet_address", walletAddress);

    if (error) throw new Error("Failed to flag player");

    await logAdminAction(supabase, "flag_player", null, walletAddress, adminWallet, reason);
    return { success: true };
}

async function unflagPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string,
    adminWallet: string
) {
    const { error } = await supabase
        .from("players")
        .update({
            flagged_for_review: false,
            flag_reason: null,
            flagged_at: null,
            flagged_by: null,
        })
        .eq("wallet_address", walletAddress);

    if (error) throw new Error("Failed to unflag player");

    await logAdminAction(supabase, "unflag_player", null, walletAddress, adminWallet, null);
    return { success: true };
}

async function checkPdaBalance(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string,
    adminWallet: string
) {
    const { data: wager, error } = await supabase
        .from("wagers")
        .select("player_a_wallet, match_id, stake_lamports")
        .eq("id", wagerId)
        .single();

    if (error || !wager) throw new Error("Wager not found");

    const connection = new Connection(RPC_URL, "confirmed");
    const wagerPDA = deriveWagerPDA(wager.player_a_wallet, BigInt(wager.match_id));
    const balance = await connection.getBalance(wagerPDA);

    await logAdminAction(supabase, "check_pda_balance", wagerId, null, adminWallet, null, {
        pda: wagerPDA.toBase58(),
        balance_lamports: balance,
    });

    return {
        success: true,
        pda: wagerPDA.toBase58(),
        balanceLamports: balance,
        balanceSol: balance / 1_000_000_000,
        expectedLamports: wager.stake_lamports * 2,
        explorerUrl: explorerAddress(wagerPDA.toBase58()),
    };
}

async function addNote(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string | null,
    walletAddress: string | null,
    note: string,
    adminWallet: string
) {
    await supabase.from("admin_notes").insert({
        wager_id: wagerId,
        player_wallet: walletAddress,
        note,
        created_by: adminWallet,
    });

    await logAdminAction(supabase, "add_note", wagerId, walletAddress, adminWallet, note);
    return { success: true };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
    }

    try {
        const body = await req.json();
        const { action, adminWallet, notes } = body;

        if (!ADMIN_WALLET || adminWallet !== ADMIN_WALLET) {
            return new Response(JSON.stringify({ error: "Forbidden: invalid admin wallet" }), {
                status: 403,
                headers: { ...CORS, "Content-Type": "application/json" },
            });
        }

        const supabase = getSupabase();
        let result: unknown;

        switch (action) {
            case "forceResolve":
                result = await forceResolve(supabase, body.wagerId, body.winnerWallet, adminWallet, notes ?? null);
                break;
            case "forceRefund":
                result = await forceRefund(supabase, body.wagerId, adminWallet, notes ?? null);
                break;
            case "markDisputed":
                result = await markDisputed(supabase, body.wagerId, adminWallet, notes ?? null);
                break;
            case "banPlayer":
                result = await banPlayer(supabase, body.playerWallet, body.reason, adminWallet);
                break;
            case "unbanPlayer":
                result = await unbanPlayer(supabase, body.playerWallet, adminWallet);
                break;
            case "flagPlayer":
                result = await flagPlayer(supabase, body.playerWallet, body.reason, adminWallet);
                break;
            case "unflagPlayer":
                result = await unflagPlayer(supabase, body.playerWallet, adminWallet);
                break;
            case "checkPdaBalance":
                result = await checkPdaBalance(supabase, body.wagerId, adminWallet);
                break;
            case "addNote":
                result = await addNote(supabase, body.wagerId ?? null, body.playerWallet ?? null, body.note, adminWallet);
                break;
            default:
                return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
                    status: 400,
                    headers: { ...CORS, "Content-Type": "application/json" },
                });
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...CORS, "Content-Type": "application/json" },
        });

    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[admin-action] Error:", message);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    }
});