import { NextRequest, NextResponse } from 'next/server';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { getSupabaseClient } from '@/integrations/supabase/client';

const supabase = getSupabaseClient();

export async function GET(request: NextRequest) {
    try {
        // ── Auth ────────────────────────────────────────────────────────────────
        let token = request.cookies.get('admin_token')?.value;
        if (!token) {
            const authHeader = request.headers.get('authorization');
            token = extractTokenFromHeader(authHeader);
        }
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tokenHash = hashToken(token);
        const sessionResult = await getSessionByTokenHash(tokenHash);
        if (!sessionResult.success || !sessionResult.session) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        // ── Parse query ─────────────────────────────────────────────────────────
        const q = request.nextUrl.searchParams.get('q')?.trim();
        if (!q) {
            return NextResponse.json({ error: 'Missing query parameter: q' }, { status: 400 });
        }

        let wager: Record<string, any> | null = null;

        // 1. Try as exact UUID (36-char with dashes)
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
            const { data } = await supabase
                .from('wagers')
                .select('id, match_id, player_a_wallet, player_b_wallet, stake_lamports, status, game')
                .eq('id', q)
                .single();
            wager = data;
        }

        // 2. Try as numeric match_id
        if (!wager && /^\d+$/.test(q)) {
            const { data } = await supabase
                .from('wagers')
                .select('id, match_id, player_a_wallet, player_b_wallet, stake_lamports, status, game')
                .eq('match_id', Number(q))
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            wager = data;
        }

        // 3. Try as player wallet address (player_a or player_b)
        if (!wager && q.length >= 32) {
            const { data } = await supabase
                .from('wagers')
                .select('id, match_id, player_a_wallet, player_b_wallet, stake_lamports, status, game')
                .or(`player_a_wallet.eq.${q},player_b_wallet.eq.${q}`)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            wager = data;
        }

        if (!wager) {
            return NextResponse.json(
                { error: `No wager found for query: "${q}". Try a wager UUID, match ID number, or player wallet address.` },
                { status: 404 }
            );
        }

        return NextResponse.json(wager);
    } catch (err: any) {
        console.error('[API /admin/wagers/inspect]', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}