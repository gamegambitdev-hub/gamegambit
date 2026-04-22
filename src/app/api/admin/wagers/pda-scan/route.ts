// src/app/api/admin/wagers/pda-scan/route.ts
//
// Bulk on-chain PDA scanner for admin use.
//
// Fetches all wagers where at least player A deposited (deposit_player_a = true),
// derives each wager's PDA, then batch-checks them on-chain via getMultipleAccounts.
// Returns a verdict for each:
//   - STUCK_FUNDS   → PDA still exists with SOL, but wager is resolved/cancelled in DB
//                     (your bug: SOL was deposited but payout never happened)
//   - ACTIVE_FUNDED → PDA exists with SOL, wager is still in progress (normal)
//   - DISTRIBUTED   → PDA closed/empty, consistent with a successful payout
//   - NOT_FOUND     → PDA never existed or already closed (normal for cancelled wagers)
//   - RPC_ERROR     → Couldn't fetch this PDA's on-chain state
//
// Query params:
//   status   (optional) filter by DB wager status. Default: all non-created statuses
//             with at least one deposit. Pass "all" to include everything.
//   limit    (optional) max wagers to scan. Default 200, max 500.
//   offset   (optional) pagination offset.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { PublicKey } from '@solana/web3.js';
import {
    PROGRAM_ID,
    DEFAULT_RPC_URL,
    ACCOUNT_DISCRIMINATORS,
} from '@/lib/solana-config';

const supabase = getSupabaseClient();

// ── Types ─────────────────────────────────────────────────────────────────────

type Verdict =
    | 'STUCK_FUNDS'
    | 'ACTIVE_FUNDED'
    | 'DISTRIBUTED'
    | 'NOT_FOUND'
    | 'RPC_ERROR'
    | 'PENDING_DEPOSIT';  // player B hasn't deposited yet — PDA may not exist yet

interface WagerRow {
    id: string;
    match_id: number;
    player_a_wallet: string;
    player_b_wallet: string | null;
    stake_lamports: number;
    status: string;
    game: string;
    created_at: string;
    deposit_player_a: boolean;
    deposit_player_b: boolean;
    winner_wallet: string | null;
    resolved_at: string | null;
    tx_signature_a: string | null;
    tx_signature_b: string | null;
}

interface ScanResult {
    wager_id: string;
    match_id: number;
    game: string;
    status: string;
    stake_lamports: number;
    stake_sol: number;
    player_a_wallet: string;
    player_b_wallet: string | null;
    winner_wallet: string | null;
    deposit_a: boolean;
    deposit_b: boolean;
    pda_address: string | null;
    pda_bump: number | null;
    pda_exists: boolean;
    pda_lamports: number;
    pda_sol: number;
    pda_account_type: string | null;
    verdict: Verdict;
    created_at: string;
    resolved_at: string | null;
}

// ── PDA derivation ─────────────────────────────────────────────────────────────

function deriveWagerPDA(playerAWallet: string, matchId: number): [string, number] | null {
    try {
        const programPubkey = new PublicKey(PROGRAM_ID);
        const playerAPubkey = new PublicKey(playerAWallet);
        const matchIdBuffer = Buffer.alloc(8);
        matchIdBuffer.writeBigUInt64LE(BigInt(matchId));
        const [pda, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from('wager'), playerAPubkey.toBuffer(), matchIdBuffer],
            programPubkey,
        );
        return [pda.toBase58(), bump];
    } catch {
        return null;
    }
}

// ── Batch RPC fetch ────────────────────────────────────────────────────────────
// Solana's getMultipleAccounts accepts up to 100 addresses per call.

const RPC_BATCH_SIZE = 100;

interface RpcAccountInfo {
    lamports: number;
    data: [string, string]; // [base64, encoding]
    owner: string;
    executable: boolean;
    rentEpoch: number;
}

async function batchFetchAccounts(
    addresses: string[],
): Promise<Map<string, { exists: boolean; lamports: number; accountType: string | null; error?: string }>> {
    const result = new Map<string, { exists: boolean; lamports: number; accountType: string | null; error?: string }>();

    for (let i = 0; i < addresses.length; i += RPC_BATCH_SIZE) {
        const batch = addresses.slice(i, i + RPC_BATCH_SIZE);

        try {
            const response = await fetch(DEFAULT_RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: `batch-${i}`,
                    method: 'getMultipleAccounts',
                    params: [batch, { encoding: 'base64' }],
                }),
            });

            if (!response.ok) {
                batch.forEach(addr => result.set(addr, { exists: false, lamports: 0, accountType: null, error: `HTTP ${response.status}` }));
                continue;
            }

            const json = await response.json();
            const accounts: (RpcAccountInfo | null)[] = json?.result?.value ?? [];

            accounts.forEach((info, idx) => {
                const addr = batch[idx];
                if (!addr) return;

                if (!info) {
                    result.set(addr, { exists: false, lamports: 0, accountType: null });
                    return;
                }

                const rawBytes = Buffer.from(info.data[0], 'base64');
                const discBytes = Array.from(rawBytes.slice(0, 8));
                const discStr = discBytes.join(',');

                let accountType: string | null = null;
                if (discStr === ACCOUNT_DISCRIMINATORS.WagerAccount.join(',')) {
                    accountType = 'WagerAccount';
                } else if (discStr === ACCOUNT_DISCRIMINATORS.PlayerProfile.join(',')) {
                    accountType = 'PlayerProfile';
                }

                result.set(addr, {
                    exists: true,
                    lamports: info.lamports,
                    accountType,
                });
            });
        } catch (err: any) {
            batch.forEach(addr =>
                result.set(addr, { exists: false, lamports: 0, accountType: null, error: err.message || 'RPC error' }),
            );
        }
    }

    return result;
}

// ── Verdict logic ──────────────────────────────────────────────────────────────

function computeVerdict(
    wager: WagerRow,
    onChain: { exists: boolean; lamports: number; accountType: string | null; error?: string } | undefined,
): Verdict {
    // If player B hasn't deposited yet, the escrow PDA may legitimately be absent
    if (!wager.deposit_player_b) return 'PENDING_DEPOSIT';

    if (!onChain || onChain.error) return 'RPC_ERROR';

    if (!onChain.exists) {
        // PDA doesn't exist on-chain → either never created or already closed/distributed
        return 'DISTRIBUTED';
    }

    // PDA exists with SOL still in it
    const hasFunds = onChain.lamports > 0;
    const isTerminal = wager.status === 'resolved' || wager.status === 'cancelled';

    if (hasFunds && isTerminal) {
        // Bug case: SOL is still sitting in the PDA even though the wager is done.
        // The payout / refund tx failed silently.
        return 'STUCK_FUNDS';
    }

    if (hasFunds && !isTerminal) {
        // Normal: game in progress, funds are escrowed as expected
        return 'ACTIVE_FUNDED';
    }

    // PDA exists but lamports = 0 → rent-exempt minimum might still be there,
    // treat as effectively distributed
    return 'DISTRIBUTED';
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    try {
        // ── Auth ──────────────────────────────────────────────────────────────
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

        // ── Parse params ─────────────────────────────────────────────────────
        const searchParams = request.nextUrl.searchParams;
        const statusFilter = searchParams.get('status') ?? 'all';
        const rawLimit = parseInt(searchParams.get('limit') ?? '200', 10);
        const limit = Math.min(Math.max(1, rawLimit), 500);
        const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));
        const verdictFilter = searchParams.get('verdict') ?? 'all'; // client-side only convenience, we return everything and let UI filter

        // ── Fetch wagers from DB ──────────────────────────────────────────────
        let query = supabase
            .from('wagers')
            .select(
                'id, match_id, player_a_wallet, player_b_wallet, stake_lamports, status, game, created_at, deposit_player_a, deposit_player_b, winner_wallet, resolved_at, tx_signature_a, tx_signature_b',
                { count: 'exact' },
            )
            .eq('deposit_player_a', true); // only wagers where at least one deposit happened

        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter as any);
        }

        const { data: wagers, error: dbError, count } = await query
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: true }); // oldest first → highest priority stuck

        if (dbError) {
            console.error('[API /admin/wagers/pda-scan] DB error:', dbError);
            return NextResponse.json({ error: dbError.message }, { status: 500 });
        }

        if (!wagers || wagers.length === 0) {
            return NextResponse.json({
                results: [],
                total: count ?? 0,
                scanned: 0,
                stuck_count: 0,
                active_funded_count: 0,
                distributed_count: 0,
                rpc_error_count: 0,
            });
        }

        // ── Derive PDAs ───────────────────────────────────────────────────────
        const pdaMap = new Map<string, [string, number] | null>(); // wager.id → [pdaAddress, bump]
        const pdaAddresses: string[] = [];

        for (const w of wagers) {
            if (!w.player_a_wallet || !w.match_id) {
                pdaMap.set(w.id, null);
                continue;
            }
            const derived = deriveWagerPDA(w.player_a_wallet, w.match_id);
            pdaMap.set(w.id, derived);
            if (derived) pdaAddresses.push(derived[0]);
        }

        // ── Batch fetch on-chain state ────────────────────────────────────────
        const uniquePdas = [...new Set(pdaAddresses)];
        const onChainMap = await batchFetchAccounts(uniquePdas);

        // ── Build results ─────────────────────────────────────────────────────
        const results: ScanResult[] = (wagers as WagerRow[]).map(w => {
            const pdaInfo = pdaMap.get(w.id) ?? null;
            const pdaAddress = pdaInfo ? pdaInfo[0] : null;
            const pdaBump = pdaInfo ? pdaInfo[1] : null;
            const onChain = pdaAddress ? onChainMap.get(pdaAddress) : undefined;

            const pdaExists = onChain?.exists ?? false;
            const pdaLamports = pdaExists ? (onChain?.lamports ?? 0) : 0;
            const verdict = computeVerdict(w, onChain);

            return {
                wager_id: w.id,
                match_id: w.match_id,
                game: w.game,
                status: w.status,
                stake_lamports: w.stake_lamports,
                stake_sol: w.stake_lamports / 1e9,
                player_a_wallet: w.player_a_wallet,
                player_b_wallet: w.player_b_wallet,
                winner_wallet: w.winner_wallet,
                deposit_a: w.deposit_player_a,
                deposit_b: w.deposit_player_b,
                pda_address: pdaAddress,
                pda_bump: pdaBump,
                pda_exists: pdaExists,
                pda_lamports: pdaLamports,
                pda_sol: pdaLamports / 1e9,
                pda_account_type: onChain?.accountType ?? null,
                verdict,
                created_at: w.created_at,
                resolved_at: w.resolved_at,
            };
        });

        // ── Summary counts ────────────────────────────────────────────────────
        const stuck_count = results.filter(r => r.verdict === 'STUCK_FUNDS').length;
        const active_funded_count = results.filter(r => r.verdict === 'ACTIVE_FUNDED').length;
        const distributed_count = results.filter(r => r.verdict === 'DISTRIBUTED').length;
        const rpc_error_count = results.filter(r => r.verdict === 'RPC_ERROR').length;
        const pending_count = results.filter(r => r.verdict === 'PENDING_DEPOSIT').length;
        const total_stuck_sol = results
            .filter(r => r.verdict === 'STUCK_FUNDS')
            .reduce((acc, r) => acc + r.pda_sol, 0);

        return NextResponse.json({
            results,
            total: count ?? 0,
            scanned: results.length,
            stuck_count,
            active_funded_count,
            distributed_count,
            rpc_error_count,
            pending_count,
            total_stuck_sol,
        });
    } catch (err: any) {
        console.error('[API /admin/wagers/pda-scan]', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}