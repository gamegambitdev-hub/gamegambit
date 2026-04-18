// supabase/functions/secure-bet/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";
// NOTE: @solana/web3.js is intentionally NOT imported at the top level.
// It's a large package that causes CPU Time exceeded on Supabase free tier
// when loaded on every cold start. It's dynamically imported only inside
// payoutFromPlatform, which runs only during actual payout operations.

// SEC-07: Import the same validateSessionToken used by secure-wager so both
// functions validate sessions identically. The old inline DB lookup
// (querying wallet_sessions table directly) was inconsistent and caused
// silent 401s for valid sessions that hadn't been written to that table.
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function validateSessionToken(token: string): Promise<string | null> {
    try {
        const dotIndex = token.lastIndexOf('.');
        if (dotIndex === -1) return null;
        const payloadB64 = token.substring(0, dotIndex);
        const hash = token.substring(dotIndex + 1);
        let payloadStr: string;
        try { payloadStr = atob(payloadB64); } catch { return null; }
        let payload: { wallet: string; exp: number };
        try { payload = JSON.parse(payloadStr); } catch { return null; }
        if (!payload.wallet || !payload.exp) return null;
        if (payload.exp < Date.now()) return null;
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payloadStr + supabaseServiceKey));
        const computedHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (computedHash !== hash) return null;
        return payload.wallet;
    } catch {
        return null;
    }
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-session-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLATFORM_WALLET = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";
const RPC_URL =
    Deno.env.get("SOLANA_RPC_URL") ??
    "https://api.devnet.solana.com";

// ── SOL payout from platform wallet ──────────────────────────────────────────

async function payoutFromPlatform(
    recipientWallet: string,
    lamports: number
): Promise<string> {
    // Dynamic import — keeps @solana/web3.js out of the cold-start bundle.
    // Only loaded when an actual payout is triggered.
    const { Connection, Keypair, PublicKey, SystemProgram, Transaction } =
        await import("https://esm.sh/@solana/web3.js@1.98.0");

    const connection = new Connection(RPC_URL, "confirmed");
    const privateKeyRaw = Deno.env.get("AUTHORITY_WALLET_SECRET");
    if (!privateKeyRaw) throw new Error("AUTHORITY_WALLET_SECRET not set");

    const secretKey = Uint8Array.from(JSON.parse(privateKeyRaw));
    const platformKeypair = Keypair.fromSecretKey(secretKey);

    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: platformKeypair.publicKey,
            toPubkey: new PublicKey(recipientWallet),
            lamports,
        })
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = platformKeypair.publicKey;
    tx.sign(platformKeypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
    });
    await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
    );
    return sig;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            supabaseServiceKey
        );

        const token = req.headers.get("x-session-token");
        if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

        const callerWallet = await validateSessionToken(token);
        if (!callerWallet) return new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 401, headers: corsHeaders });

        const body = await req.json();
        const { action } = body;

        // ── place ──
        if (action === "place") {
            const { wagerId, backedPlayer, amountLamports, txSignature } = body;
            if (!wagerId || !backedPlayer || !amountLamports || !txSignature) {
                return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
            }

            // Block if wager is in voting/resolved/cancelled
            const { data: wager } = await supabase
                .from("wagers")
                .select("status, player_a_wallet, player_b_wallet")
                .eq("id", wagerId)
                .single();

            if (!wager) return new Response(JSON.stringify({ error: "Wager not found" }), { status: 404, headers: corsHeaders });
            if (["voting", "resolved", "cancelled"].includes(wager.status)) {
                return new Response(JSON.stringify({ error: "Betting is closed for this wager" }), { status: 400, headers: corsHeaders });
            }

            // Players can't bet on their own match
            if (callerWallet === wager.player_a_wallet || callerWallet === wager.player_b_wallet) {
                return new Response(JSON.stringify({ error: "Players cannot place side bets on their own wager" }), { status: 400, headers: corsHeaders });
            }

            const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString(); // 30 min to find a match

            const { data: bet, error } = await supabase
                .from("spectator_bets")
                .insert({
                    wager_id: wagerId,
                    bettor_wallet: callerWallet,
                    backed_player: backedPlayer,
                    amount_lamports: amountLamports,
                    tx_signature: txSignature,
                    expires_at: expiresAt,
                })
                .select()
                .single();

            if (error) throw error;
            return new Response(JSON.stringify({ bet }), { headers: corsHeaders });
        }

        // ── counter ──
        if (action === "counter") {
            const { betId, counterAmountLamports } = body;
            const { data: bet } = await supabase
                .from("spectator_bets")
                .select("*")
                .eq("id", betId)
                .single();

            if (!bet) return new Response(JSON.stringify({ error: "Bet not found" }), { status: 404, headers: corsHeaders });
            if (bet.status !== "open") return new Response(JSON.stringify({ error: "Bet is not open for counter-offers" }), { status: 400, headers: corsHeaders });
            if (bet.bettor_wallet === callerWallet) return new Response(JSON.stringify({ error: "Cannot counter your own bet" }), { status: 400, headers: corsHeaders });

            const { error } = await supabase
                .from("spectator_bets")
                .update({ status: "countered", counter_amount: counterAmountLamports, backer_wallet: callerWallet })
                .eq("id", betId);

            if (error) throw error;
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        // ── accept ──
        if (action === "accept") {
            const { betId, txSignature } = body;
            const { data: bet } = await supabase
                .from("spectator_bets")
                .select("*")
                .eq("id", betId)
                .single();

            if (!bet) return new Response(JSON.stringify({ error: "Bet not found" }), { status: 404, headers: corsHeaders });
            if (!["open", "countered"].includes(bet.status)) {
                return new Response(JSON.stringify({ error: "Bet cannot be accepted in its current state" }), { status: 400, headers: corsHeaders });
            }
            if (bet.bettor_wallet === callerWallet) {
                return new Response(JSON.stringify({ error: "Cannot accept your own bet" }), { status: 400, headers: corsHeaders });
            }

            const { error } = await supabase
                .from("spectator_bets")
                .update({
                    status: "matched",
                    backer_wallet: callerWallet,
                    matched_at: new Date().toISOString(),
                })
                .eq("id", betId);

            if (error) throw error;
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        // ── cancel ──
        if (action === "cancel") {
            const { betId } = body;
            const { data: bet } = await supabase
                .from("spectator_bets")
                .select("*")
                .eq("id", betId)
                .single();

            if (!bet) return new Response(JSON.stringify({ error: "Bet not found" }), { status: 404, headers: corsHeaders });
            if (bet.bettor_wallet !== callerWallet) return new Response(JSON.stringify({ error: "Not your bet" }), { status: 403, headers: corsHeaders });
            if (bet.status !== "open") return new Response(JSON.stringify({ error: "Only open bets can be cancelled" }), { status: 400, headers: corsHeaders });

            // Refund the original bettor
            await payoutFromPlatform(bet.bettor_wallet, bet.amount_lamports);

            const { error } = await supabase
                .from("spectator_bets")
                .update({ status: "cancelled" })
                .eq("id", betId);

            if (error) throw error;
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        // ── resolveForWager — called by resolve-wager after main wager settles ──
        if (action === "resolveForWager") {
            const { wagerId, winnerPlayer } = body; // winnerPlayer: 'player_a' | 'player_b' | null (draw)

            // Only callable internally (service role check via no session token required here
            // but we still validate token for basic auth)
            const { data: bets } = await supabase
                .from("spectator_bets")
                .select("*")
                .eq("wager_id", wagerId)
                .eq("status", "matched");

            if (!bets || bets.length === 0) {
                return new Response(JSON.stringify({ resolved: 0 }), { headers: corsHeaders });
            }

            const PLATFORM_CUT = 0.05; // 5% of side bet pot
            let resolved = 0;

            for (const bet of bets) {
                try {
                    if (!winnerPlayer) {
                        // Draw — refund both
                        await payoutFromPlatform(bet.bettor_wallet, bet.amount_lamports);
                        if (bet.backer_wallet) {
                            const backerAmount = bet.counter_amount ?? bet.amount_lamports;
                            await payoutFromPlatform(bet.backer_wallet, backerAmount);
                        }
                    } else {
                        const winnerWallet =
                            bet.backed_player === winnerPlayer
                                ? bet.bettor_wallet
                                : bet.backer_wallet;
                        const loserAmount =
                            bet.backed_player === winnerPlayer
                                ? (bet.counter_amount ?? bet.amount_lamports)
                                : bet.amount_lamports;

                        if (winnerWallet) {
                            const pot = bet.amount_lamports + (bet.counter_amount ?? bet.amount_lamports);
                            const payout = Math.floor(pot * (1 - PLATFORM_CUT));
                            await payoutFromPlatform(winnerWallet, payout);
                        }
                    }

                    await supabase
                        .from("spectator_bets")
                        .update({ status: "resolved", resolved_at: new Date().toISOString() })
                        .eq("id", bet.id);

                    resolved++;
                } catch (e) {
                    console.error("Failed to resolve side bet", bet.id, e);
                }
            }

            // Also expire unmatched open bets and refund
            const { data: openBets } = await supabase
                .from("spectator_bets")
                .select("*")
                .eq("wager_id", wagerId)
                .eq("status", "open");

            for (const bet of openBets ?? []) {
                try {
                    await payoutFromPlatform(bet.bettor_wallet, bet.amount_lamports);
                    await supabase
                        .from("spectator_bets")
                        .update({ status: "expired" })
                        .eq("id", bet.id);
                } catch (e) {
                    console.error("Failed to refund open bet", bet.id, e);
                }
            }

            return new Response(JSON.stringify({ resolved }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("secure-bet error:", msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
    }
});