import { NextRequest, NextResponse } from 'next/server';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Fail loudly at module-load time so a misconfigured deployment produces a
// clear server log instead of a cryptic "TypeError: Failed to parse URL" 500.
if (!supabaseUrl) {
    console.error('[Admin API] FATAL: NEXT_PUBLIC_SUPABASE_URL is not set');
}
if (!supabaseServiceKey) {
    console.error('[Admin API] FATAL: SUPABASE_SERVICE_ROLE_KEY is not set');
}

export async function POST(request: NextRequest) {
    try {
        // Guard: bail out early with a useful message rather than letting
        // fetch() throw "TypeError: Failed to parse URL" when env vars are absent.
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { success: false, error: 'Server misconfiguration: missing Supabase env vars' },
                { status: 500 }
            );
        }

        // ── Session auth — same pattern as every other admin route ───────────────
        let token = request.cookies.get('admin_token')?.value;

        if (!token) {
            const authHeader = request.headers.get('authorization');
            token = extractTokenFromHeader(authHeader);
        }

        if (!token) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const tokenHash = hashToken(token);
        const sessionResult = await getSessionByTokenHash(tokenHash);

        if (!sessionResult.success || !sessionResult.session) {
            return NextResponse.json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
        }
        // ─────────────────────────────────────────────────────────────────────────

        const body = await request.json() as {
            action: string;
            adminWallet: string;
            wagerId?: string;
            winnerWallet?: string;
            playerWallet?: string;
            reason?: string;
            notes?: string;
        };

        const { action, adminWallet, wagerId, winnerWallet, playerWallet, reason, notes } = body;

        if (!adminWallet) {
            return NextResponse.json({ success: false, error: 'Admin wallet required' }, { status: 400 });
        }

        // Map camelCase frontend action names → snake_case edge function action names
        // (actions.ts sends snake_case, but handle both just in case)
        const actionMap: Record<string, string> = {
            force_resolve: 'forceResolve',
            force_refund: 'forceRefund',
            mark_disputed: 'markDisputed',
            ban_player: 'banPlayer',
            flag_player: 'flagPlayer',
            unban_player: 'unbanPlayer',
            unflag_player: 'unflagPlayer',
            // pass-through if already camelCase
            forceResolve: 'forceResolve',
            forceRefund: 'forceRefund',
            markDisputed: 'markDisputed',
            banPlayer: 'banPlayer',
            flagPlayer: 'flagPlayer',
            unbanPlayer: 'unbanPlayer',
            unflagPlayer: 'unflagPlayer',
            checkPdaBalance: 'checkPdaBalance',
            addNote: 'addNote',
            recoverStuckPda: 'recoverStuckPda',
        };

        const edgeAction = actionMap[action];
        if (!edgeAction) {
            return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }

        // Validate required fields per action
        if (edgeAction === 'forceResolve' && (!wagerId || !winnerWallet)) {
            return NextResponse.json({ success: false, error: 'Missing required fields: wagerId, winnerWallet' }, { status: 400 });
        }
        if (['forceRefund', 'markDisputed', 'checkPdaBalance'].includes(edgeAction) && !wagerId) {
            return NextResponse.json({ success: false, error: 'Missing required field: wagerId' }, { status: 400 });
        }
        if (['banPlayer', 'flagPlayer', 'unbanPlayer', 'unflagPlayer'].includes(edgeAction) && !playerWallet) {
            return NextResponse.json({ success: false, error: 'Missing required field: playerWallet' }, { status: 400 });
        }

        // Build payload for edge function
        const payload: Record<string, unknown> = {
            action: edgeAction,
            adminWallet,
            ...(wagerId && { wagerId }),
            ...(winnerWallet && { winnerWallet }),
            ...(playerWallet && { playerWallet }),
            ...(reason && { reason }),
            ...(notes && { notes }),
        };

        // Call admin-action edge function directly with service role key
        const edgeRes = await fetch(`${supabaseUrl}/functions/v1/admin-action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
            },
            body: JSON.stringify(payload),
        });

        const data = await edgeRes.json().catch(() => ({ error: edgeRes.statusText }));

        if (!edgeRes.ok) {
            console.error('[Admin API] Edge function error:', data);
            return NextResponse.json(
                { success: false, error: (data as { error?: string }).error || 'Edge function failed' },
                { status: edgeRes.status }
            );
        }

        return NextResponse.json({ success: true, message: `${edgeAction} completed successfully`, ...data });

    } catch (error) {
        // Log the full error (including stack) so the real cause is visible in
        // server logs — previously only error.message was logged, hiding TypeError
        // and other non-Error throws entirely.
        console.error('[Admin API] Unhandled error:', error instanceof Error ? error.stack : error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to process admin action' },
            { status: 500 }
        );
    }
}