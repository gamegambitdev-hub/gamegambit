// src/app/api/username/change-request/route.ts
//
// POST /api/username/change-request
// Body: {
//   game: 'pubg' | 'codm' | 'free_fire',
//   oldUsername: string,
//   newUsername: string,
//   reason: string,        (min 10 chars)
//   reasonCategory: 'name_changed' | 'account_banned_in_game' | 'entry_error' | 'other'
// }
//
// Creates a username_change_requests row for admin review.
// Enforces max 2 approved/pending requests per game per year.
//
// Auth: X-Session-Token (HMAC-SHA256, same as secure-player)
//
// NOTE: username_change_requests and player_behaviour_log are new tables.
// is_suspended and suspension_ends_at are new columns on players.
// We use `as any` on all new-table queries and new-column accesses until
// `supabase gen types` is re-run after the migrations are applied.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { Database } from '@/integrations/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const secret = process.env.AUTHORITY_WALLET_SECRET!;

const ALLOWED_GAMES = ['pubg', 'codm', 'free_fire'] as const;
type AllowedGame = typeof ALLOWED_GAMES[number];

const ALLOWED_CATEGORIES = [
    'name_changed',
    'account_banned_in_game',
    'entry_error',
    'other',
] as const;

// Max pending + approved requests per game per 12-month rolling window
const MAX_REQUESTS_PER_YEAR = 2;

// ── Session validation ────────────────────────────────────────────────────────

async function validateSessionToken(token: string): Promise<string | null> {
    try {
        const dotIndex = token.lastIndexOf('.');
        if (dotIndex === -1) return null;

        const payloadB64 = token.substring(0, dotIndex);
        const hash = token.substring(dotIndex + 1);

        let payloadStr: string;
        try { payloadStr = Buffer.from(payloadB64, 'base64').toString('utf-8'); }
        catch { return null; }

        let payload: { wallet: string; exp: number };
        try { payload = JSON.parse(payloadStr); }
        catch { return null; }

        if (!payload.wallet || !payload.exp) return null;
        if (payload.exp < Date.now()) return null;

        const computedHash = crypto
            .createHash('sha256')
            .update(payloadStr + secret)
            .digest('hex');

        if (computedHash !== hash) return null;
        return payload.wallet;
    } catch {
        return null;
    }
}

function json(body: unknown, status = 200) {
    return NextResponse.json(body, { status });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const token = req.headers.get('X-Session-Token')?.trim();
    if (!token) return json({ error: 'Unauthorised' }, 401);

    const wallet = await validateSessionToken(token);
    if (!wallet) return json({ error: 'Invalid or expired session' }, 401);

    let body: {
        game?: string;
        oldUsername?: string;
        newUsername?: string;
        reason?: string;
        reasonCategory?: string;
    };
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }

    const { game, oldUsername, newUsername, reason, reasonCategory } = body;

    // ── Input validation ──────────────────────────────────────────────────────

    if (!game || !ALLOWED_GAMES.includes(game as AllowedGame)) {
        return json({ error: 'Invalid game. Must be pubg, codm, or free_fire.' }, 400);
    }
    if (!oldUsername || typeof oldUsername !== 'string' || !oldUsername.trim()) {
        return json({ error: 'oldUsername is required' }, 400);
    }
    if (!newUsername || typeof newUsername !== 'string' || !newUsername.trim()) {
        return json({ error: 'newUsername is required' }, 400);
    }
    if (oldUsername.trim().toLowerCase() === newUsername.trim().toLowerCase()) {
        return json({ error: 'New username is the same as the current one' }, 400);
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
        return json({ error: 'reason must be at least 10 characters' }, 400);
    }
    if (reason.trim().length > 500) {
        return json({ error: 'reason must be 500 characters or less' }, 400);
    }
    if (!reasonCategory || !ALLOWED_CATEGORIES.includes(reasonCategory as typeof ALLOWED_CATEGORIES[number])) {
        return json({ error: `reasonCategory must be one of: ${ALLOWED_CATEGORIES.join(', ')}` }, 400);
    }

    const cleanGame = game as AllowedGame;
    const cleanOld = oldUsername.trim();
    const cleanNew = newUsername.trim();
    const cleanReason = reason.trim();
    const cleanCategory = reasonCategory as typeof ALLOWED_CATEGORIES[number];

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // ── 1. Check player exists and is not banned/suspended ────────────────────
    const { data: player, error: playerErr } = await supabase
        .from('players')
        .select('wallet_address, is_banned')
        .eq('wallet_address', wallet)
        .maybeSingle();

    if (playerErr || !player) {
        return json({ error: 'Player not found' }, 404);
    }

    if (player.is_banned) {
        return json({ error: 'Banned accounts cannot submit change requests' }, 403);
    }

    // Check suspension via new column — use any cast since column isn't in stale types
    const { data: suspension } = await (supabase
        .from('players')
        .select('is_suspended, suspension_ends_at')
        .eq('wallet_address', wallet)
        .maybeSingle() as any) as {
            data: { is_suspended: boolean; suspension_ends_at: string | null } | null;
        };

    if (suspension?.is_suspended) {
        const endsAt = suspension.suspension_ends_at
            ? new Date(suspension.suspension_ends_at).toLocaleDateString()
            : 'indefinitely';
        return json({ error: `Account is suspended until ${endsAt}. Change requests are unavailable.` }, 403);
    }

    // ── 2. Verify oldUsername matches what's actually on their account ─────────
    // We need to check the actual column — use any to access new game columns
    const usernameColumnMap: Record<AllowedGame, string> = {
        pubg: 'pubg_username',
        codm: 'codm_username',
        free_fire: 'free_fire_username',
    };
    const usernameCol = usernameColumnMap[cleanGame];

    const { data: currentData } = await (supabase
        .from('players')
        .select(usernameCol)
        .eq('wallet_address', wallet)
        .maybeSingle() as any) as { data: Record<string, string | null> | null };

    const currentUsername = currentData?.[usernameCol] ?? null;

    if (!currentUsername) {
        return json({ error: `You don't have a ${cleanGame.toUpperCase()} username linked yet. Nothing to change.` }, 400);
    }
    if (currentUsername.toLowerCase() !== cleanOld.toLowerCase()) {
        return json({ error: `The username "${cleanOld}" doesn't match your currently linked ${cleanGame.toUpperCase()} username.` }, 400);
    }

    // ── 3. Enforce max 2 requests per game per rolling 12 months ─────────────
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentRequests, error: countErr } = await (supabase
        .from('username_change_requests' as any)
        .select('id, status, created_at')
        .eq('player_wallet', wallet)
        .eq('game', cleanGame)
        .in('status', ['pending_review', 'approved'])
        .gte('created_at', oneYearAgo) as any) as {
            data: Array<{ id: string; status: string; created_at: string }> | null;
            error: unknown;
        };

    if (countErr) {
        console.error('[change-request] count error:', countErr);
        return json({ error: 'Failed to check request history' }, 500);
    }

    if ((recentRequests?.length ?? 0) >= MAX_REQUESTS_PER_YEAR) {
        return json({
            error: `You have reached the maximum of ${MAX_REQUESTS_PER_YEAR} username change requests per year for ${cleanGame.toUpperCase()}. Please wait before submitting another.`,
        }, 429);
    }

    // ── 4. Create the change request row ──────────────────────────────────────
    const { data: newRequest, error: insertErr } = await (supabase
        .from('username_change_requests' as any)
        .insert({
            player_wallet: wallet,
            game: cleanGame,
            old_username: cleanOld,
            new_username: cleanNew,
            reason: cleanReason,
            reason_category: cleanCategory,
            status: 'pending_review',
        })
        .select('id')
        .single() as any) as { data: { id: string } | null; error: unknown };

    if (insertErr || !newRequest) {
        console.error('[change-request] insert error:', insertErr);
        return json({ error: 'Failed to submit change request' }, 500);
    }

    // ── 5. Log behaviour event ────────────────────────────────────────────────
    await (supabase
        .from('player_behaviour_log' as any)
        .insert({
            player_wallet: wallet,
            event_type: 'change_request_submitted',
            related_id: newRequest.id,
            notes: `${cleanGame} change request: "${cleanOld}" → "${cleanNew}" (category: ${cleanCategory})`,
        }) as any);

    // ── 6. Notify the player ──────────────────────────────────────────────────
    await supabase
        .from('notifications')
        .insert({
            player_wallet: wallet,
            type: 'username_change_request',
            title: 'Change request submitted',
            message: `Your request to change your ${cleanGame.toUpperCase()} username from "${cleanOld}" to "${cleanNew}" is under review. You'll be notified of the outcome.`,
            wager_id: null,
        } as any);

    return json({
        ok: true,
        requestId: newRequest.id,
        message: 'Your change request has been submitted and is under review. You\'ll be notified of the outcome.',
    });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        },
    });
}