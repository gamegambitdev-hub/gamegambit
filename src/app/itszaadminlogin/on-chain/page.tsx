'use client';

// src/app/itszaadminlogin/on-chain/page.tsx
//
// Force dynamic rendering — this page uses useSearchParams() which requires
// it to opt out of Next.js static generation, otherwise the build may
// silently fail to render this route and it won't appear accessible.

export const dynamic = 'force-dynamic';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Cpu, Search, Loader2, AlertTriangle, Copy, Check,
    ExternalLink, RefreshCcw, ChevronDown, ChevronUp, Database
} from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useSearchParams } from 'next/navigation';
import {
    PROGRAM_ID, DEFAULT_RPC_URL, SOLANA_NETWORK,
    ACCOUNT_DISCRIMINATORS, getExplorerUrl
} from '@/lib/solana-config';

// ── helpers ────────────────────────────────────────────────────────────────────

function derivePDA(seeds: (Buffer | Uint8Array)[]): [string, number] | null {
    try {
        const programPubkey = new PublicKey(PROGRAM_ID);
        const [pda, bump] = PublicKey.findProgramAddressSync(seeds, programPubkey);
        return [pda.toBase58(), bump];
    } catch {
        return null;
    }
}

function deriveWagerPDA(playerAWallet: string, matchId: number): [string, number] | null {
    try {
        const playerAPubkey = new PublicKey(playerAWallet);
        const matchIdBuffer = Buffer.alloc(8);
        matchIdBuffer.writeBigUInt64LE(BigInt(matchId));
        return derivePDA([Buffer.from('wager'), playerAPubkey.toBuffer(), matchIdBuffer]);
    } catch {
        return null;
    }
}

function derivePlayerProfilePDA(wallet: string): [string, number] | null {
    try {
        const pubkey = new PublicKey(wallet);
        return derivePDA([Buffer.from('player'), pubkey.toBuffer()]);
    } catch {
        return null;
    }
}

async function fetchAccountInfo(address: string): Promise<OnChainAccount> {
    try {
        const response = await fetch(DEFAULT_RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getAccountInfo',
                params: [address, { encoding: 'base64' }],
            }),
        });
        const json = await response.json();
        const info = json?.result?.value;
        if (!info) return { exists: false, lamports: 0, dataSize: 0, owner: null, discriminator: null };

        const rawBytes = Buffer.from(info.data[0], 'base64');
        const discBytes = Array.from(rawBytes.slice(0, 8));

        let accountType: string = 'Unknown';
        if (discBytes.join(',') === ACCOUNT_DISCRIMINATORS.WagerAccount.join(',')) {
            accountType = 'WagerAccount';
        } else if (discBytes.join(',') === ACCOUNT_DISCRIMINATORS.PlayerProfile.join(',')) {
            accountType = 'PlayerProfile';
        }

        return {
            exists: true,
            lamports: info.lamports,
            dataSize: rawBytes.length,
            owner: info.owner,
            discriminator: discBytes,
            accountType,
            executable: info.executable,
            rentEpoch: info.rentEpoch,
        };
    } catch {
        return { exists: false, lamports: 0, dataSize: 0, owner: null, discriminator: null, error: 'RPC fetch failed' };
    }
}

// ── types ──────────────────────────────────────────────────────────────────────

interface OnChainAccount {
    exists: boolean;
    lamports: number;
    dataSize: number;
    owner: string | null;
    discriminator: number[] | null;
    accountType?: string;
    executable?: boolean;
    rentEpoch?: number;
    error?: string;
}

interface WagerResult {
    id: string;
    match_id: number;
    player_a_wallet: string;
    player_b_wallet: string | null;
    stake_lamports: number;
    status: string;
    game: string;
}

interface InspectorResult {
    wager: WagerResult;
    wagerPDA: [string, number] | null;
    playerAPDA: [string, number] | null;
    playerBPDA: [string, number] | null;
    onChain: {
        wager: OnChainAccount | null;
        playerA: OnChainAccount | null;
        playerB: OnChainAccount | null;
    };
}

// ── sub-components ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-muted-foreground hover:text-primary transition-colors p-0.5 flex-shrink-0"
        >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
    );
}

function ExplorerButton({ address }: { address: string }) {
    return (
        <a
            href={getExplorerUrl('address', address, SOLANA_NETWORK)}
            target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors p-0.5 flex-shrink-0"
            title="View on Solana Explorer"
        >
            <ExternalLink className="h-3.5 w-3.5" />
        </a>
    );
}

function AccountBadge({ account }: { account: OnChainAccount | null }) {
    if (!account) return <span className="text-xs text-muted-foreground">—</span>;
    if (account.error) return <span className="text-xs text-red-400">RPC Error</span>;
    if (!account.exists) return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">
            Not Found
        </span>
    );
    return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Exists
        </span>
    );
}

function AccountCard({
    label,
    address,
    bump,
    account,
}: {
    label: string;
    address: string | null;
    bump: number | null;
    account: OnChainAccount | null;
}) {
    const [expanded, setExpanded] = useState(false);
    const solBalance = account?.exists ? (account.lamports / 1e9).toFixed(6) : null;

    return (
        <div className="bg-background/50 rounded-2xl border border-border/40 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-border/30">
                <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary/70" />
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    {account?.accountType && account.exists && (
                        <span className="text-xs text-primary/70 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                            {account.accountType}
                        </span>
                    )}
                </div>
                <AccountBadge account={account} />
            </div>

            <div className="px-4 py-3 space-y-2.5">
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">PDA Address</p>
                    {address ? (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-foreground break-all">{address}</span>
                            <CopyButton text={address} />
                            <ExplorerButton address={address} />
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground italic">Could not derive (missing player B)</span>
                    )}
                </div>

                {bump !== null && (
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Bump</p>
                        <span className="text-xs font-mono text-amber-400">{bump}</span>
                    </div>
                )}

                {account?.exists && solBalance && (
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Balance</p>
                        <span className="text-lg font-gaming font-bold text-amber-400">{solBalance} SOL</span>
                        <span className="text-xs text-muted-foreground ml-2">({account.lamports.toLocaleString()} lamports)</span>
                    </div>
                )}

                {account?.exists && (
                    <button
                        onClick={() => setExpanded(x => !x)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {expanded ? 'Hide' : 'Show'} raw details
                    </button>
                )}

                <AnimatePresence>
                    {expanded && account?.exists && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-card/50 rounded-xl p-3 border border-border/30 space-y-1.5 text-xs font-mono">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Owner</span>
                                    <span className="text-foreground break-all text-right max-w-[60%]">{account.owner}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Data size</span>
                                    <span className="text-foreground">{account.dataSize} bytes</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Executable</span>
                                    <span className={account.executable ? 'text-emerald-400' : 'text-muted-foreground'}>
                                        {account.executable ? 'Yes' : 'No'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Discriminator</span>
                                    <span className="text-foreground">[{account.discriminator?.join(', ')}]</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// ── main inspector ─────────────────────────────────────────────────────────────

function OnChainInspectorContent() {
    const searchParams = useSearchParams();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<InspectorResult | null>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    const inspect = useCallback(async (searchQuery?: string) => {
        const q = (searchQuery ?? query).trim();
        if (!q) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const params = new URLSearchParams({ q });
            const res = await fetch(`/api/admin/wagers/inspect?${params}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}`);
            }
            const wager: WagerResult = await res.json();

            const wagerPDA = deriveWagerPDA(wager.player_a_wallet, wager.match_id);
            const playerAPDA = derivePlayerProfilePDA(wager.player_a_wallet);
            const playerBPDA = wager.player_b_wallet ? derivePlayerProfilePDA(wager.player_b_wallet) : null;

            const [wagerOnChain, playerAOnChain, playerBOnChain] = await Promise.all([
                wagerPDA ? fetchAccountInfo(wagerPDA[0]) : Promise.resolve(null),
                playerAPDA ? fetchAccountInfo(playerAPDA[0]) : Promise.resolve(null),
                playerBPDA ? fetchAccountInfo(playerBPDA[0]) : Promise.resolve(null),
            ]);

            setResult({
                wager,
                wagerPDA,
                playerAPDA,
                playerBPDA,
                onChain: {
                    wager: wagerOnChain,
                    playerA: playerAOnChain,
                    playerB: playerBOnChain,
                },
            });

            setRecentSearches(prev => [q, ...prev.filter(s => s !== q)].slice(0, 5));
        } catch (e: any) {
            setError(e.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [query]);

    // Pre-fill and auto-run from URL param ?q=...
    // (used when navigating from the Wagers drawer "On-Chain" button or PDA Scanner)
    useEffect(() => {
        const preload = searchParams.get('q');
        if (preload) {
            setQuery(preload);
            inspect(preload);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') inspect();
    };

    return (
        <ProtectedRoute>
            <div className="space-y-6 max-w-3xl">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 rounded-xl p-3 border border-cyan-500/20">
                        <Cpu className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-gaming font-bold text-glow">On-Chain Inspector</h1>
                        <p className="text-sm text-muted-foreground">Inspect PDA addresses and live on-chain balances for any wager</p>
                    </div>
                </motion.div>

                {/* Search */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20 space-y-3">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Wager UUID, match ID (number), or player wallet..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKey}
                                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground text-sm"
                            />
                        </div>
                        <button
                            onClick={() => inspect()}
                            disabled={loading || !query.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                            Inspect
                        </button>
                    </div>

                    {recentSearches.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            <span className="text-xs text-muted-foreground self-center">Recent:</span>
                            {recentSearches.map(s => (
                                <button
                                    key={s}
                                    onClick={() => { setQuery(s); inspect(s); }}
                                    className="text-xs font-mono bg-card/60 border border-border/40 hover:border-primary/40 text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg transition-colors truncate max-w-[180px]"
                                >
                                    {s.length > 20 ? `${s.slice(0, 10)}...${s.slice(-6)}` : s}
                                </button>
                            ))}
                        </div>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                        Accepts: full wager UUID · numeric match ID · player A or B wallet address
                    </p>
                </motion.div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />{error}
                    </div>
                )}

                {/* Loading skeleton */}
                {loading && (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-40 bg-card/40 rounded-2xl border border-border/30 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Results */}
                {result && !loading && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                        {/* Wager summary bar */}
                        <div className="glass rounded-2xl p-4 border border-primary/20 flex flex-wrap gap-4 items-center">
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Wager ID</p>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-mono text-foreground">{result.wager.id.slice(0, 16)}...</span>
                                    <CopyButton text={result.wager.id} />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Match ID</p>
                                <span className="text-sm font-gaming font-bold text-foreground">#{result.wager.match_id}</span>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                                <span className="text-xs font-semibold text-primary capitalize">{result.wager.status}</span>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stake</p>
                                <span className="text-sm font-gaming text-amber-400">
                                    {(result.wager.stake_lamports / 1e9).toFixed(4)} SOL
                                </span>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Game</p>
                                <span className="text-xs text-foreground capitalize">{result.wager.game}</span>
                            </div>
                        </div>

                        {/* PDA Cards */}
                        <div className="space-y-3">
                            <AccountCard
                                label="Wager PDA"
                                address={result.wagerPDA?.[0] ?? null}
                                bump={result.wagerPDA?.[1] ?? null}
                                account={result.onChain.wager}
                            />
                            <AccountCard
                                label="Player A Profile PDA"
                                address={result.playerAPDA?.[0] ?? null}
                                bump={result.playerAPDA?.[1] ?? null}
                                account={result.onChain.playerA}
                            />
                            <AccountCard
                                label="Player B Profile PDA"
                                address={result.playerBPDA?.[0] ?? null}
                                bump={result.playerBPDA?.[1] ?? null}
                                account={result.onChain.playerB}
                            />
                        </div>

                        {/* Derivation reference */}
                        <div className="bg-background/30 border border-border/30 rounded-2xl p-4 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PDA Seed Reference</p>
                            <div className="space-y-1.5 text-xs font-mono">
                                <p className="text-muted-foreground">
                                    <span className="text-cyan-400">Wager PDA</span>: seeds = [<span className="text-amber-400">&quot;wager&quot;</span>, player_a, match_id.to_le_bytes()]
                                </p>
                                <p className="text-muted-foreground">
                                    <span className="text-cyan-400">Player Profile PDA</span>: seeds = [<span className="text-amber-400">&quot;player&quot;</span>, wallet]
                                </p>
                                <p className="text-muted-foreground">
                                    <span className="text-cyan-400">Program</span>:{' '}
                                    <a
                                        href={getExplorerUrl('address', PROGRAM_ID, SOLANA_NETWORK)}
                                        target="_blank" rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                    >
                                        {PROGRAM_ID.slice(0, 16)}...{PROGRAM_ID.slice(-8)}
                                    </a>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Empty state */}
                {!result && !loading && !error && (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                        <Cpu className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-sm">Search for a wager to inspect its on-chain state</p>
                        <p className="text-xs mt-1 opacity-60">Derives PDAs using the same seeds as the Rust program</p>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function OnChainInspectorPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <OnChainInspectorContent />
        </Suspense>
    );
}