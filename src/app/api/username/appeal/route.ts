// src/app/api/username/appeal/route.ts
//
// POST /api/username/appeal
// Body: { game: 'pubg' | 'codm' | 'free_fire', username: string }
//
// Called by GameAccountCard when a player tries to bind a username that is
// already linked to another wallet. Creates a row in username_appeals and
// sends a notification to the current holder.
//
// Auth: X-Session-Token (same HMAC-SHA256 scheme as secure-player)
//
// NOTE: username_appeals and player_behaviour_log are new tables from
// migration 003. Until types are regenerated, we use `as any` on those
// table queries only. All players table queries remain fully typed.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { Database } from '@/integrations/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const secret = process.env.AUTHORITY_WALLET_SECRET!;

const ALLOWED_GAMES = ['pubg', 'codm', 'free_fire'] as const;
type AllowedGame = typeof ALLOWED_GAMES[number];

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUsernameColumn(game: AllowedGame): string {
    switch (game) {
        case 'pubg': return 'pubg_username';
        case 'codm': return 'codm_username';
        case 'free_fire': return 'free_fire_username';
    }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const token = req.headers.get('X-Session-Token')?.trim();
    if (!token) return json({ error: 'Unauthorised' }, 401);

    const claimantWallet = await validateSessionToken(token);
    if (!claimantWallet) return json({ error: 'Invalid or expired session' }, 401);

    let body: { game?: string; username?: string };
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }

    const { game, username } = body;

    if (!game || !ALLOWED_GAMES.includes(game as AllowedGame)) {
        return json({ error: 'Invalid game. Must be pubg, codm, or free_fire.' }, 400);
    }
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return json({ error: 'Username is required' }, 400);
    }

    const cleanUsername = username.trim();
    const validGame = game as AllowedGame;
    const usernameColumn = getUsernameColumn(validGame);

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // ── 1. Find the current holder ────────────────────────────────────────────
    // We use `as any` on the column name because the new game columns may not
    // be in the stale types yet. The data is still correct at runtime.
    const { data: holderRow, error: holderErr } = await (supabase
        .from('players')
        .select('wallet_address, username')
        .eq(usernameColumn as 'wallet_address', cleanUsername)   // cast silences TS, runtime is correct
        .neq('wallet_address', claimantWallet)
        .maybeSingle() as any) as {
            data: { wallet_address: string; username: string | null } | null;
            error: unknown;
        };

    if (holderErr) {
        console.error('[appeal POST] holder lookup error:', holderErr);
        return json({ error: 'Failed to look up username' }, 500);
    }

    if (!holderRow) {
        // Username isn't actually taken anymore (race condition) — let the bind proceed
        return json({ error: 'USERNAME_NOT_TAKEN', message: 'Username is now available. Please try binding again.' }, 409);
    }

    const holderWallet = holderRow.wallet_address;

    // ── 2. Check for an existing open appeal for this exact combo ─────────────
    const { data: existingAppeal } = await (supabase
        .from('username_appeals' as any)
        .select('id, status')
        .eq('claimant_wallet', claimantWallet)
        .eq('holder_wallet', holderWallet)
        .eq('game', validGame)
        .eq('username', cleanUsername)
        .in('status', ['pending_response', 'contested', 'moderating'])
        .maybeSingle() as any) as { data: { id: string; status: string } | null };

    if (existingAppeal) {
        return json({
            error: 'APPEAL_EXISTS',
            message: 'You already have an open appeal for this username. Check your notifications for updates.',
            appealId: existingAppeal.id,
        }, 409);
    }

    // ── 3. Create the appeal row ───────────────────────────────────────────────
    const responseDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: newAppeal, error: insertErr } = await (supabase
        .from('username_appeals' as any)
        .insert({
            claimant_wallet: claimantWallet,
            holder_wallet: holderWallet,
            game: validGame,
            username: cleanUsername,
            status: 'pending_response',
            response_deadline: responseDeadline,
        })
        .select('id')
        .single() as any) as { data: { id: string } | null; error: unknown };

    if (insertErr || !newAppeal) {
        console.error('[appeal POST] insert error:', insertErr);
        return json({ error: 'Failed to create appeal' }, 500);
    }

    // ── 4. Notify the holder ──────────────────────────────────────────────────
    // We insert an in-app notification. The holder sees it in their
    // NotificationsDropdown. If they have push enabled, the push_subscriptions
    // system will pick it up separately.
    await supabase
        .from('notifications')
        .insert({
            player_wallet: holderWallet,
            type: 'username_appeal',
            title: 'Someone has claimed your username',
            message: `Another player has filed a claim on your ${validGame.toUpperCase()} username "${cleanUsername}". You have 48 hours to respond.`,
            wager_id: null,          // no wager associated
        } as any);

    // ── 5. Log behaviour event for the claimant ───────────────────────────────
    await (supabase
        .from('player_behaviour_log' as any)
        .insert({
            player_wallet: claimantWallet,
            event_type: 'appeal_filed',
            related_id: newAppeal.id,
            notes: `Filed appeal for ${validGame} username "${cleanUsername}"`,
        }) as any);

    return json({
        ok: true,
        appealId: newAppeal.id,
        message: 'Appeal submitted. The current account holder has been notified and has 48 hours to respond.',
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