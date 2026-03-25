// src/app/api/username/appeal/respond/route.ts
//
// POST /api/username/appeal/respond
// Body: { appealId: string, response: 'release' | 'contest' }
//
// Called when the holder responds to a username appeal:
//   release  → clears their username, claimant can now bind it
//   contest  → kicks off moderator review (future step)
//
// Auth: X-Session-Token — must be the holder's wallet
//
// NOTE: username_appeals and player_behaviour_log are new tables.
// We use `as any` on those table references until types are regenerated.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { Database } from '@/integrations/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const secret = process.env.AUTHORITY_WALLET_SECRET!;

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

// Typed appeal row shape — what we get from the DB query
interface AppealRow {
    id: string;
    claimant_wallet: string;
    holder_wallet: string;
    game: string;
    username: string;
    status: string;
    response_deadline: string;
}

function json(body: unknown, status = 200) {
    return NextResponse.json(body, { status });
}

function getUsernameColumn(game: string): string | null {
    switch (game) {
        case 'pubg': return 'pubg_username';
        case 'codm': return 'codm_username';
        case 'free_fire': return 'free_fire_username';
        default: return null;
    }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const token = req.headers.get('X-Session-Token')?.trim();
    if (!token) return json({ error: 'Unauthorised' }, 401);

    const wallet = await validateSessionToken(token);
    if (!wallet) return json({ error: 'Invalid or expired session' }, 401);

    let body: { appealId?: string; response?: string };
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }

    const { appealId, response } = body;

    if (!appealId || typeof appealId !== 'string') {
        return json({ error: 'appealId is required' }, 400);
    }
    if (response !== 'release' && response !== 'contest') {
        return json({ error: 'response must be "release" or "contest"' }, 400);
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // ── 1. Fetch the appeal ───────────────────────────────────────────────────
    const { data: appeal, error: fetchErr } = await (supabase
        .from('username_appeals' as any)
        .select('id, claimant_wallet, holder_wallet, game, username, status, response_deadline')
        .eq('id', appealId)
        .maybeSingle() as any) as { data: AppealRow | null; error: unknown };

    if (fetchErr) {
        console.error('[appeal/respond] fetch error:', fetchErr);
        return json({ error: 'Failed to fetch appeal' }, 500);
    }
    if (!appeal) return json({ error: 'Appeal not found' }, 404);

    // ── 2. Authorise — only the holder can respond ────────────────────────────
    if (appeal.holder_wallet !== wallet) {
        return json({ error: 'Only the username holder can respond to this appeal' }, 403);
    }

    // ── 3. Status guard ───────────────────────────────────────────────────────
    if (appeal.status !== 'pending_response') {
        return json({ error: `Appeal is already in "${appeal.status}" status and cannot be updated` }, 409);
    }

    // ── 4. Deadline guard ─────────────────────────────────────────────────────
    if (new Date(appeal.response_deadline) < new Date()) {
        // Mark as escalated — holder missed the window
        await (supabase
            .from('username_appeals' as any)
            .update({ status: 'escalated' })
            .eq('id', appealId) as any);
        return json({ error: 'Response deadline has passed. This appeal has been escalated.' }, 410);
    }

    const usernameColumn = getUsernameColumn(appeal.game);
    if (!usernameColumn) return json({ error: 'Unknown game in appeal record' }, 500);

    // ── 5a. RELEASE — holder gives up the username ────────────────────────────
    if (response === 'release') {
        // Clear the username from the holder's player row
        const { error: clearErr } = await supabase
            .from('players')
            .update({ [usernameColumn]: null } as any)
            .eq('wallet_address', wallet);

        if (clearErr) {
            console.error('[appeal/respond] clear username error:', clearErr);
            return json({ error: 'Failed to release username' }, 500);
        }

        // Update appeal status
        await (supabase
            .from('username_appeals' as any)
            .update({
                status: 'released',
                holder_response: 'release',
                holder_responded_at: new Date().toISOString(),
                resolved_at: new Date().toISOString(),
            })
            .eq('id', appealId) as any);

        // Log behaviour events for both parties
        await (supabase
            .from('player_behaviour_log' as any)
            .insert([
                {
                    player_wallet: wallet,
                    event_type: 'username_released_voluntarily',
                    related_id: appealId,
                    notes: `Released ${appeal.game} username "${appeal.username}" after appeal`,
                },
                {
                    player_wallet: appeal.claimant_wallet,
                    event_type: 'appeal_upheld',
                    related_id: appealId,
                    notes: `Username "${appeal.username}" released by holder`,
                },
            ]) as any);

        // Notify claimant
        await supabase
            .from('notifications')
            .insert({
                player_wallet: appeal.claimant_wallet,
                type: 'username_appeal_resolved',
                title: 'Username released',
                message: `The player who held "${appeal.username}" has released it. You can now link it to your account.`,
                wager_id: null,
            } as any);

        // Notify holder
        await supabase
            .from('notifications')
            .insert({
                player_wallet: wallet,
                type: 'username_appeal_resolved',
                title: 'Appeal resolved — thank you',
                message: `You released "${appeal.username}". This has been noted positively on your account.`,
                wager_id: null,
            } as any);

        return json({
            ok: true,
            status: 'released',
            message: 'Username released. The claimant has been notified and can now link it.',
        });
    }

    // ── 5b. CONTEST — holder disputes the claim ───────────────────────────────
    // Update appeal status to 'contested'. Moderator assignment is a separate
    // step handled by the admin panel or a future edge function.
    await (supabase
        .from('username_appeals' as any)
        .update({
            status: 'contested',
            holder_response: 'contest',
            holder_responded_at: new Date().toISOString(),
        })
        .eq('id', appealId) as any);

    // Log for both parties
    await (supabase
        .from('player_behaviour_log' as any)
        .insert([
            {
                player_wallet: wallet,
                event_type: 'username_dispute_filed',
                related_id: appealId,
                notes: `Contested appeal for ${appeal.game} username "${appeal.username}"`,
            },
            {
                player_wallet: appeal.claimant_wallet,
                event_type: 'appeal_filed',
                related_id: appealId,
                notes: `Holder contested ownership of "${appeal.username}"`,
            },
        ]) as any);

    // Notify claimant that the holder is contesting
    await supabase
        .from('notifications')
        .insert({
            player_wallet: appeal.claimant_wallet,
            type: 'username_appeal_update',
            title: 'Username appeal — under review',
            message: `The current holder of "${appeal.username}" has disputed your claim. A moderator will review this. Both parties may be asked to provide proof of ownership.`,
            wager_id: null,
        } as any);

    // Notify holder
    await supabase
        .from('notifications')
        .insert({
            player_wallet: wallet,
            type: 'username_appeal_update',
            title: 'Your dispute is under review',
            message: `You contested the appeal for "${appeal.username}". Our team will review both claims. You may be asked to provide a screenshot of your in-game profile.`,
            wager_id: null,
        } as any);

    return json({
        ok: true,
        status: 'contested',
        message: 'Your response has been recorded. A review will begin shortly.',
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