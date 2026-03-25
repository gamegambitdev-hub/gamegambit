import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username } = body as { username?: string };

        if (!username || typeof username !== 'string' || !username.trim()) {
            return NextResponse.json({ valid: false, error: 'Username is required' }, { status: 400 });
        }

        const trimmed = username.trim();

        const apiKey = process.env.PUBG_API_KEY;
        if (!apiKey) {
            // No API key configured — return unverifiable so the UI can still proceed
            // with a manual confirmation flow (same as CODM / Free Fire)
            return NextResponse.json({ valid: null, error: 'PUBG API not configured' });
        }

        // PUBG Mobile uses the 'kakao' shard for mobile; 'steam' for PC.
        // We try the mobile shard first. Adjust if your player base is PC.
        const shard = 'steam';

        const res = await fetch(
            `https://api.pubg.com/shards/${shard}/players?filter[playerNames]=${encodeURIComponent(trimmed)}`,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Accept: 'application/vnd.api+json',
                },
                // 8-second hard timeout — we don't want a slow PUBG API to hang the modal
                signal: AbortSignal.timeout(8000),
            },
        );

        if (res.status === 404) {
            return NextResponse.json({ valid: false, error: 'Username not found' });
        }

        if (!res.ok) {
            // Treat non-404 errors (rate limit, server error) as "unverifiable"
            // so the user can still proceed — same UX as CODM.
            return NextResponse.json({ valid: null, error: `PUBG API error: ${res.status}` });
        }

        const json = await res.json();
        const player = json?.data?.[0];

        if (!player) {
            return NextResponse.json({ valid: false, error: 'Username not found' });
        }

        return NextResponse.json({
            valid: true,
            accountId: player.id as string,
            displayName: player.attributes?.name as string,
        });
    } catch (err) {
        if (err instanceof Error && err.name === 'TimeoutError') {
            return NextResponse.json({ valid: null, error: 'PUBG API timed out' });
        }
        console.error('[pubg/verify-username]', err);
        return NextResponse.json({ valid: null, error: 'Verification unavailable' });
    }
}