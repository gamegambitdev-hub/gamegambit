'use client';

// src/app/itszaadminlogin/pda-scanner/page.tsx
//
// Bulk on-chain PDA scanner + batch recovery.
// Loads all wagers with at least one deposit from the DB, derives their PDAs,
// batch-checks them on Solana, and shows each one's verdict.
//
// Verdict legend:
//   🔴 STUCK_FUNDS     — PDA has SOL but wager is resolved/cancelled. Bug: payout failed.
//   🟡 ACTIVE_FUNDED   — PDA has SOL, wager still in progress. Normal.
//   🟢 DISTRIBUTED     — PDA closed/empty. Funds correctly distributed.
//   ⚪ NOT_FOUND       — PDA never existed or already closed.
//   🔵 PENDING_DEPOSIT — Player B hasn't deposited yet.
//   ❌ RPC_ERROR       — Couldn't reach Solana RPC for this PDA.

import { Suspense, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ScanSearch, Loader2, AlertTriangle, Copy, Check,
    ExternalLink, RefreshCcw, ChevronDown, ChevronUp,
    Download, Filter, X, CheckCircle2,
    Circle, WifiOff, Zap, Square, CheckSquare, Play,
    Trophy, RotateCcw, StopCircle, Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getExplorerUrl, SOLANA_NETWORK } from '@/lib/solana-config';
import { useWallet } from '@solana/wallet-adapter-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type Verdict =
    | 'STUCK_FUNDS'
    | 'ACTIVE_FUNDED'
    | 'DISTRIBUTED'
    | 'NOT_FOUND'
    | 'RPC_ERROR'
    | 'PENDING_DEPOSIT';

type BatchAction = 'forceRefund' | 'forceResolve';
type RowStatus = 'idle' | 'processing' | 'success' | 'error';

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

interface ScanResponse {
    results: ScanResult[];
    total: number;
    scanned: number;
    stuck_count: number;
    active_funded_count: number;
    distributed_count: number;
    rpc_error_count: number;
    pending_count: number;
    total_stuck_sol: number;
}

interface BatchResult {
    wager_id: string;
    status: RowStatus;
    error?: string;
}

// ── Verdict config ─────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<Verdict, {
    label: string;
    emoji: string;
    color: string;
    bg: string;
    border: string;
    description: string;
}> = {
    STUCK_FUNDS: {
        label: 'Stuck Funds',
        emoji: '🔴',
        color: 'text-red-400',
        bg: 'bg-red-500/15',
        border: 'border-red-500/40',
        description: 'PDA has SOL but wager is already resolved/cancelled. Payout likely failed.',
    },
    ACTIVE_FUNDED: {
        label: 'Active',
        emoji: '🟡',
        color: 'text-amber-400',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/30',
        description: 'PDA has SOL, wager still in progress. Normal.',
    },
    DISTRIBUTED: {
        label: 'Distributed',
        emoji: '🟢',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/30',
        description: 'PDA is closed or empty. Funds correctly paid out.',
    },
    NOT_FOUND: {
        label: 'Not Found',
        emoji: '⚪',
        color: 'text-slate-400',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        description: 'PDA never existed on-chain or already closed.',
    },
    PENDING_DEPOSIT: {
        label: 'Pending B',
        emoji: '🔵',
        color: 'text-blue-400',
        bg: 'bg-blue-500/15',
        border: 'border-blue-500/30',
        description: 'Player B has not deposited yet.',
    },
    RPC_ERROR: {
        label: 'RPC Error',
        emoji: '❌',
        color: 'text-muted-foreground',
        bg: 'bg-muted/20',
        border: 'border-border/30',
        description: 'Could not reach Solana RPC for this PDA.',
    },
};

const STATUS_LABELS: Record<string, string> = {
    all: 'All Statuses',
    created: 'Created',
    joined: 'Joined',
    voting: 'Voting',
    retractable: 'Retractable',
    disputed: 'Disputed',
    resolved: 'Resolved',
    cancelled: 'Cancelled',
};

// ── Small helpers ──────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
    return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h ago`;
    if (h > 0) return `${h}h ${m}m ago`;
    return `${m}m ago`;
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={e => {
                e.stopPropagation();
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }}
            className="text-muted-foreground hover:text-primary transition-colors p-0.5 flex-shrink-0"
        >
            {copied
                ? <Check className="h-3 w-3 text-emerald-400" />
                : <Copy className="h-3 w-3" />}
        </button>
    );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
    const cfg = VERDICT_CONFIG[verdict];
    return (
        <span className={cn(
            'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap',
            cfg.color, cfg.bg, cfg.border,
        )}>
            {cfg.emoji} {cfg.label}
        </span>
    );
}

// ── Summary cards ──────────────────────────────────────────────────────────────

function SummaryCard({
    emoji, label, value, sub, highlight,
}: {
    emoji: string;
    label: string;
    value: number | string;
    sub?: string;
    highlight?: boolean;
}) {
    return (
        <div className={cn(
            'glass rounded-2xl p-4 border flex flex-col gap-1',
            highlight ? 'border-red-500/40 bg-red-500/5' : 'border-border/30',
        )}>
            <div className="flex items-center gap-2">
                <span className="text-lg">{emoji}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <span className={cn('text-2xl font-gaming font-bold', highlight ? 'text-red-400' : 'text-foreground')}>
                {value}
            </span>
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
    );
}

// ── Row success flash overlay ──────────────────────────────────────────────────

function SuccessFlash({ action }: { action: BatchAction }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
        >
            <div className="flex items-center gap-2 bg-emerald-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {action === 'forceRefund' ? 'Refunded ✓' : 'Resolved ✓'}
            </div>
        </motion.div>
    );
}

// ── Batch progress bar ─────────────────────────────────────────────────────────

function BatchProgressBar({
    done, total, errors, action, onStop,
}: {
    done: number;
    total: number;
    errors: number;
    action: BatchAction;
    onStop: () => void;
}) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const finished = done === total;

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
                'rounded-2xl p-4 border space-y-3',
                finished
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-primary/5 border-primary/20',
            )}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {finished
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        : <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                    <span className="text-sm font-semibold text-foreground">
                        {finished
                            ? `Batch complete — ${done - errors} succeeded, ${errors} failed`
                            : `${action === 'forceRefund' ? 'Refunding' : 'Resolving'} ${done} / ${total}…`}
                    </span>
                </div>
                {!finished && (
                    <button
                        onClick={onStop}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors border border-border/40 hover:border-red-400/40 px-2.5 py-1 rounded-lg"
                    >
                        <StopCircle className="h-3.5 w-3.5" />
                        Stop
                    </button>
                )}
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                <motion.div
                    className={cn('h-full rounded-full', finished ? 'bg-emerald-500' : 'bg-primary')}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{pct}% complete</span>
                {errors > 0 && (
                    <span className="text-red-400 font-semibold">{errors} error{errors !== 1 ? 's' : ''}</span>
                )}
            </div>
        </motion.div>
    );
}

// ── Row expand detail (with batch row state awareness) ─────────────────────────

function ResultRow({
    r, idx, selected, onToggle, rowStatus, currentAction, batchRunning,
}: {
    r: ScanResult;
    idx: number;
    selected: boolean;
    onToggle: (id: string) => void;
    rowStatus: RowStatus;
    currentAction: BatchAction | null;
    batchRunning: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const cfg = VERDICT_CONFIG[r.verdict];
    const isStuck = r.verdict === 'STUCK_FUNDS';

    const isProcessing = rowStatus === 'processing';
    const isSuccess = rowStatus === 'success';
    const isError = rowStatus === 'error';

    return (
        <>
            <motion.tr
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.012 }}
                className={cn(
                    'border-b border-border/20 text-sm transition-colors relative',
                    isSuccess && 'opacity-40',
                    isProcessing && 'bg-primary/5',
                    isError && 'bg-red-500/5',
                    !isSuccess && !isProcessing && (
                        isStuck
                            ? 'bg-red-500/5 hover:bg-red-500/10'
                            : 'hover:bg-muted/30'
                    ),
                )}
            >
                {/* Checkbox — only for STUCK_FUNDS */}
                <td className="pl-3 pr-1 py-3 w-8" onClick={e => e.stopPropagation()}>
                    {isStuck && !batchRunning && (
                        <button
                            onClick={() => onToggle(r.wager_id)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                        >
                            {selected
                                ? <CheckSquare className="h-4 w-4 text-primary" />
                                : <Square className="h-4 w-4" />}
                        </button>
                    )}
                    {isProcessing && (
                        <Loader2 className="h-4 w-4 text-primary animate-spin ml-0.5" />
                    )}
                    {isSuccess && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 12 }}
                        >
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </motion.div>
                    )}
                    {isError && (
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                    )}
                </td>

                {/* Match ID */}
                <td
                    className="px-3 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap cursor-pointer"
                    onClick={() => !batchRunning && setExpanded(x => !x)}
                >
                    #{r.match_id}
                </td>

                {/* Game */}
                <td className="px-3 py-3 text-xs capitalize cursor-pointer" onClick={() => !batchRunning && setExpanded(x => !x)}>
                    {r.game}
                </td>

                {/* DB Status */}
                <td className="px-3 py-3 cursor-pointer" onClick={() => !batchRunning && setExpanded(x => !x)}>
                    <span className="text-xs font-medium text-muted-foreground capitalize">{r.status}</span>
                </td>

                {/* Stake */}
                <td className="px-3 py-3 text-xs font-mono text-amber-400 whitespace-nowrap cursor-pointer" onClick={() => !batchRunning && setExpanded(x => !x)}>
                    {r.stake_sol.toFixed(4)} SOL
                </td>

                {/* PDA Balance */}
                <td className="px-3 py-3 text-xs font-mono whitespace-nowrap cursor-pointer" onClick={() => !batchRunning && setExpanded(x => !x)}>
                    {r.pda_exists
                        ? <span className={r.pda_sol > 0 ? 'text-amber-400' : 'text-muted-foreground'}>{r.pda_sol.toFixed(4)} SOL</span>
                        : <span className="text-muted-foreground/50">—</span>}
                </td>

                {/* Verdict */}
                <td className="px-3 py-3 cursor-pointer" onClick={() => !batchRunning && setExpanded(x => !x)}>
                    {isSuccess && currentAction ? (
                        <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 whitespace-nowrap"
                        >
                            ✓ {currentAction === 'forceRefund' ? 'Refunded' : 'Resolved'}
                        </motion.span>
                    ) : isError ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/15 text-red-400 whitespace-nowrap">
                            ✗ Failed
                        </span>
                    ) : (
                        <VerdictBadge verdict={r.verdict} />
                    )}
                </td>

                {/* Age */}
                <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap cursor-pointer" onClick={() => !batchRunning && setExpanded(x => !x)}>
                    {timeAgo(r.created_at)}
                </td>

                {/* Expand toggle */}
                <td className="px-3 py-3 text-right cursor-pointer" onClick={() => !batchRunning && setExpanded(x => !x)}>
                    {!batchRunning && (expanded
                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground inline" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground inline" />)}
                </td>
            </motion.tr>

            {/* Success shimmer overlay row */}
            <AnimatePresence>
                {isSuccess && (
                    <tr>
                        <td colSpan={9} className="p-0 h-0">
                            <motion.div
                                initial={{ scaleX: 0, opacity: 0.8 }}
                                animate={{ scaleX: 1, opacity: 0 }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                style={{ transformOrigin: 'left' }}
                                className="h-0.5 bg-gradient-to-r from-emerald-500 via-emerald-300 to-transparent"
                            />
                        </td>
                    </tr>
                )}
            </AnimatePresence>

            {/* Expand detail */}
            <AnimatePresence>
                {expanded && !batchRunning && (
                    <tr>
                        <td colSpan={9} className="p-0">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="px-4 py-4 bg-card/40 border-b border-border/20 space-y-3">
                                    {/* Verdict explanation */}
                                    <div className={cn('text-xs px-3 py-2 rounded-xl border', cfg.bg, cfg.border, cfg.color)}>
                                        <span className="font-semibold">{cfg.emoji} {cfg.label}:</span> {cfg.description}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                                        {/* Wager ID */}
                                        <div className="bg-background/50 rounded-xl border border-border/30 p-3 space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Wager ID</p>
                                            <div className="flex items-center gap-1">
                                                <span className="font-mono text-foreground break-all">{r.wager_id}</span>
                                                <CopyButton text={r.wager_id} />
                                            </div>
                                        </div>

                                        {/* PDA Address */}
                                        <div className="bg-background/50 rounded-xl border border-border/30 p-3 space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">PDA Address</p>
                                            {r.pda_address ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-foreground break-all">{r.pda_address}</span>
                                                    <CopyButton text={r.pda_address} />
                                                    <a
                                                        href={getExplorerUrl('address', r.pda_address, SOLANA_NETWORK)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={e => e.stopPropagation()}
                                                        className="text-muted-foreground hover:text-primary transition-colors p-0.5 flex-shrink-0"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground italic">Could not derive</span>
                                            )}
                                        </div>

                                        {/* Player A */}
                                        <div className="bg-background/50 rounded-xl border border-border/30 p-3 space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Player A {r.deposit_a ? '✅' : '⬜'}</p>
                                            <div className="flex items-center gap-1">
                                                <span className="font-mono text-foreground">{shortAddr(r.player_a_wallet)}</span>
                                                <CopyButton text={r.player_a_wallet} />
                                            </div>
                                        </div>

                                        {/* Player B */}
                                        <div className="bg-background/50 rounded-xl border border-border/30 p-3 space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Player B {r.deposit_b ? '✅' : '⬜'}</p>
                                            {r.player_b_wallet ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-foreground">{shortAddr(r.player_b_wallet)}</span>
                                                    <CopyButton text={r.player_b_wallet} />
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground italic">None yet</span>
                                            )}
                                        </div>

                                        {/* Winner */}
                                        <div className="bg-background/50 rounded-xl border border-border/30 p-3 space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Winner</p>
                                            {r.winner_wallet ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-foreground">{shortAddr(r.winner_wallet)}</span>
                                                    <CopyButton text={r.winner_wallet} />
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground italic">None yet</span>
                                            )}
                                        </div>

                                        {/* On-chain details */}
                                        <div className="bg-background/50 rounded-xl border border-border/30 p-3 space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">On-Chain</p>
                                            <div className="space-y-0.5">
                                                <p><span className="text-muted-foreground">Exists:</span> <span className="text-foreground">{r.pda_exists ? 'Yes' : 'No'}</span></p>
                                                <p><span className="text-muted-foreground">Lamports:</span> <span className="text-foreground">{r.pda_lamports.toLocaleString()}</span></p>
                                                <p><span className="text-muted-foreground">Account type:</span> <span className="text-foreground">{r.pda_account_type ?? '—'}</span></p>
                                                {r.pda_bump !== null && <p><span className="text-muted-foreground">Bump:</span> <span className="text-foreground">{r.pda_bump}</span></p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick-link to single inspector */}
                                    <div className="pt-1">
                                        <a
                                            href={`/itszaadminlogin/on-chain?q=${encodeURIComponent(r.wager_id)}`}
                                            onClick={e => e.stopPropagation()}
                                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            Open in On-Chain Inspector
                                        </a>
                                    </div>
                                </div>
                            </motion.div>
                        </td>
                    </tr>
                )}
            </AnimatePresence>
        </>
    );
}

// ── Batch action panel ─────────────────────────────────────────────────────────

function BatchPanel({
    selectedIds, allStuck, onSelectAll, onClearAll, onExecute, batchRunning, results,
}: {
    selectedIds: Set<string>;
    allStuck: ScanResult[];
    onSelectAll: () => void;
    onClearAll: () => void;
    onExecute: (action: BatchAction) => void;
    batchRunning: boolean;
    results: Map<string, BatchResult>;
}) {
    const count = selectedIds.size;
    const canResolveAll = allStuck
        .filter(r => selectedIds.has(r.wager_id))
        .every(r => r.winner_wallet !== null);

    if (batchRunning || count === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="glass rounded-2xl p-4 border border-primary/30 bg-primary/5 space-y-3"
        >
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <div className="bg-primary/20 rounded-lg p-1.5">
                        <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">
                            {count} wager{count !== 1 ? 's' : ''} selected
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {allStuck.filter(r => selectedIds.has(r.wager_id)).reduce((s, r) => s + r.pda_sol, 0).toFixed(4)} SOL will be processed
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onSelectAll}
                        className="text-xs text-primary hover:underline"
                    >
                        Select all {allStuck.length}
                    </button>
                    <span className="text-muted-foreground/40">|</span>
                    <button
                        onClick={onClearAll}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {/* Force Refund — always available for stuck */}
                <button
                    onClick={() => onExecute('forceRefund')}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold rounded-xl text-sm transition-colors"
                >
                    <RotateCcw className="h-4 w-4" />
                    Batch Refund All
                </button>

                {/* Force Resolve — only if all selected have a winner_wallet */}
                <button
                    onClick={() => onExecute('forceResolve')}
                    disabled={!canResolveAll}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={!canResolveAll ? 'Some selected wagers have no winner_wallet recorded' : undefined}
                >
                    <Trophy className="h-4 w-4" />
                    Batch Resolve (use recorded winner)
                </button>
            </div>

            {!canResolveAll && count > 0 && (
                <p className="text-xs text-muted-foreground">
                    ⚠️ Some selected wagers have no <span className="font-mono text-foreground/70">winner_wallet</span> — use Batch Refund or deselect those rows to use Batch Resolve.
                </p>
            )}
        </motion.div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function PdaScannerContent() {
    const { publicKey } = useWallet();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanData, setScanData] = useState<ScanResponse | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [verdictFilter, setVerdictFilter] = useState<Verdict | 'all'>('all');
    const [limitStr, setLimitStr] = useState('200');
    const [sortCol, setSortCol] = useState<'created_at' | 'pda_sol' | 'stake_sol'>('created_at');
    const [sortAsc, setSortAsc] = useState(true);
    const [searchText, setSearchText] = useState('');

    // Batch state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchAction, setBatchAction] = useState<BatchAction | null>(null);
    const [rowStatuses, setRowStatuses] = useState<Map<string, BatchResult>>(new Map());
    const [batchDone, setBatchDone] = useState(0);
    const [batchTotal, setBatchTotal] = useState(0);
    const [batchErrors, setBatchErrors] = useState(0);
    const stopRef = useRef(false);

    // Toast
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    const runScan = useCallback(async () => {
        setLoading(true);
        setError(null);
        setScanData(null);
        setSelectedIds(new Set());
        setRowStatuses(new Map());
        setBatchDone(0);
        setBatchTotal(0);

        try {
            const params = new URLSearchParams({
                status: statusFilter,
                limit: String(Math.min(500, Math.max(1, parseInt(limitStr) || 200))),
                offset: '0',
            });
            const res = await fetch(`/api/admin/wagers/pda-scan?${params}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            const data: ScanResponse = await res.json();
            setScanData(data);
        } catch (e: any) {
            setError(e.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, limitStr]);

    // ── Filtered + sorted results ────────────────────────────────────────────
    const displayResults = useMemo(() => {
        if (!scanData) return [];
        let rows = [...scanData.results];

        if (verdictFilter !== 'all') {
            rows = rows.filter(r => r.verdict === verdictFilter);
        }

        if (searchText.trim()) {
            const q = searchText.trim().toLowerCase();
            rows = rows.filter(r =>
                r.wager_id.toLowerCase().includes(q) ||
                String(r.match_id).includes(q) ||
                r.player_a_wallet.toLowerCase().includes(q) ||
                (r.player_b_wallet?.toLowerCase().includes(q) ?? false) ||
                (r.pda_address?.toLowerCase().includes(q) ?? false),
            );
        }

        rows.sort((a, b) => {
            let diff = 0;
            if (sortCol === 'created_at') diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (sortCol === 'pda_sol') diff = a.pda_sol - b.pda_sol;
            if (sortCol === 'stake_sol') diff = a.stake_sol - b.stake_sol;
            return sortAsc ? diff : -diff;
        });

        return rows;
    }, [scanData, verdictFilter, searchText, sortCol, sortAsc]);

    const stuckResults = useMemo(
        () => displayResults.filter(r => r.verdict === 'STUCK_FUNDS'),
        [displayResults],
    );

    // ── CSV export ───────────────────────────────────────────────────────────
    const exportCsv = useCallback(() => {
        if (!displayResults.length) return;
        const headers = [
            'match_id', 'wager_id', 'game', 'status', 'stake_sol',
            'pda_address', 'pda_exists', 'pda_sol', 'verdict',
            'player_a_wallet', 'player_b_wallet', 'winner_wallet',
            'created_at', 'resolved_at',
        ];
        const rows = displayResults.map(r => [
            r.match_id, r.wager_id, r.game, r.status, r.stake_sol.toFixed(6),
            r.pda_address ?? '', r.pda_exists ? 'true' : 'false', r.pda_sol.toFixed(6), r.verdict,
            r.player_a_wallet, r.player_b_wallet ?? '', r.winner_wallet ?? '',
            r.created_at, r.resolved_at ?? '',
        ]);
        const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pda-scan-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [displayResults]);

    // ── Batch execution ──────────────────────────────────────────────────────
    const executeBatch = useCallback(async (action: BatchAction) => {
        if (!publicKey) {
            showToast('error', 'Connect your wallet first');
            return;
        }

        const targets = stuckResults.filter(r => selectedIds.has(r.wager_id));
        if (targets.length === 0) return;

        stopRef.current = false;
        setBatchRunning(true);
        setBatchAction(action);
        setBatchDone(0);
        setBatchTotal(targets.length);
        setBatchErrors(0);

        const newStatuses = new Map<string, BatchResult>();

        for (let i = 0; i < targets.length; i++) {
            if (stopRef.current) break;

            const r = targets[i];

            // Mark as processing
            newStatuses.set(r.wager_id, { wager_id: r.wager_id, status: 'processing' });
            setRowStatuses(new Map(newStatuses));

            // Small visual delay so the "processing" state is visible
            await new Promise(res => setTimeout(res, 180));

            try {
                const body: Record<string, unknown> = {
                    action,
                    adminWallet: publicKey.toBase58(),
                    wagerId: r.wager_id,
                    notes: `Batch ${action} from PDA scanner`,
                };

                if (action === 'forceResolve' && r.winner_wallet) {
                    body.winnerWallet = r.winner_wallet;
                }

                const res = await fetch('/api/admin/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(body),
                });

                const result = await res.json();

                if (!result.success) throw new Error(result.error || 'Action failed');

                newStatuses.set(r.wager_id, { wager_id: r.wager_id, status: 'success' });
                setRowStatuses(new Map(newStatuses));
                setBatchDone(i + 1);

                // Brief pause between calls to avoid rate-limiting
                await new Promise(res => setTimeout(res, 300));

            } catch (err: any) {
                newStatuses.set(r.wager_id, {
                    wager_id: r.wager_id,
                    status: 'error',
                    error: err.message,
                });
                setRowStatuses(new Map(newStatuses));
                setBatchDone(i + 1);
                setBatchErrors(p => p + 1);

                // Still pause on error
                await new Promise(res => setTimeout(res, 150));
            }
        }

        const finalDone = targets.filter(r => newStatuses.get(r.wager_id)?.status === 'success').length;
        const finalErrors = targets.filter(r => newStatuses.get(r.wager_id)?.status === 'error').length;

        showToast(
            finalErrors === 0 ? 'success' : 'error',
            `Batch complete: ${finalDone} succeeded, ${finalErrors} failed`,
        );

        setSelectedIds(new Set());
        setBatchRunning(false);
    }, [publicKey, selectedIds, stuckResults]);

    // ── Selection helpers ────────────────────────────────────────────────────
    const toggleRow = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(new Set(stuckResults.map(r => r.wager_id)));
    }, [stuckResults]);

    const clearAll = useCallback(() => setSelectedIds(new Set()), []);

    const toggleSort = (col: typeof sortCol) => {
        if (sortCol === col) setSortAsc(x => !x);
        else { setSortCol(col); setSortAsc(true); }
    };

    const SortIcon = ({ col }: { col: typeof sortCol }) =>
        sortCol === col
            ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />)
            : null;

    const allStuckSelected = stuckResults.length > 0 && stuckResults.every(r => selectedIds.has(r.wager_id));
    const someStuckSelected = stuckResults.some(r => selectedIds.has(r.wager_id));

    return (
        <ProtectedRoute requiredRole="admin">
            <div className="space-y-6 max-w-6xl">

                {/* Toast */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={cn(
                                'fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium',
                                toast.type === 'success'
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                    : 'bg-red-500/15 border-red-500/30 text-red-400',
                            )}
                        >
                            {toast.type === 'success'
                                ? <CheckCircle2 className="h-4 w-4" />
                                : <AlertTriangle className="h-4 w-4" />}
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-violet-500/20 to-violet-600/20 rounded-xl p-3 border border-violet-500/20">
                        <ScanSearch className="h-6 w-6 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-gaming font-bold text-glow">PDA Bulk Scanner</h1>
                        <p className="text-sm text-muted-foreground">
                            Scan all wager PDAs at once — find stuck funds, verify distributions, and batch-recover SOL
                        </p>
                    </div>
                </motion.div>

                {/* Controls */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20 space-y-4">

                    <div className="flex flex-wrap gap-3 items-end">
                        {/* Status filter */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">DB Status Filter</label>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                                    <option key={val} value={val}>{lbl}</option>
                                ))}
                            </select>
                        </div>

                        {/* Limit */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Wagers</label>
                            <select
                                value={limitStr}
                                onChange={e => setLimitStr(e.target.value)}
                                className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                {['50', '100', '200', '500'].map(v => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </div>

                        {/* Scan button */}
                        <button
                            onClick={runScan}
                            disabled={loading || batchRunning}
                            className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 self-end"
                        >
                            {loading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</>
                                : <><ScanSearch className="h-4 w-4" /> Scan All PDAs</>}
                        </button>

                        {/* Export */}
                        {scanData && displayResults.length > 0 && !batchRunning && (
                            <button
                                onClick={exportCsv}
                                className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 hover:border-primary/40 text-foreground font-medium rounded-xl text-sm transition-colors self-end"
                            >
                                <Download className="h-4 w-4" />
                                Export CSV
                            </button>
                        )}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                        Fetches wagers from DB where <span className="font-mono text-primary/70">deposit_player_a = true</span>,
                        derives each PDA using <span className="font-mono text-primary/70">[&quot;wager&quot;, player_a, match_id_le]</span>,
                        then batch-checks Solana via <span className="font-mono text-primary/70">getMultipleAccounts</span> in batches of 100.
                    </p>
                </motion.div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />{error}
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm">Deriving PDAs and querying Solana RPC…</p>
                        <p className="text-xs opacity-60">This may take a few seconds for large batches</p>
                    </div>
                )}

                {/* Results */}
                {scanData && !loading && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

                        {/* Summary cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <SummaryCard emoji="🔍" label="Scanned" value={scanData.scanned} sub={`of ${scanData.total} total`} />
                            <SummaryCard emoji="🔴" label="Stuck Funds" value={scanData.stuck_count} sub={`${scanData.total_stuck_sol.toFixed(4)} SOL total`} highlight={scanData.stuck_count > 0} />
                            <SummaryCard emoji="🟡" label="Active" value={scanData.active_funded_count} />
                            <SummaryCard emoji="🟢" label="Distributed" value={scanData.distributed_count} />
                            <SummaryCard emoji="🔵" label="Pending B" value={scanData.pending_count} />
                            <SummaryCard emoji="❌" label="RPC Errors" value={scanData.rpc_error_count} />
                        </div>

                        {/* Stuck-funds alert banner */}
                        {scanData.stuck_count > 0 && !batchRunning && rowStatuses.size === 0 && (
                            <div className="bg-red-500/10 border border-red-500/40 rounded-2xl px-4 py-3 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-red-400">
                                        {scanData.stuck_count} wager{scanData.stuck_count !== 1 ? 's' : ''} with stuck funds detected
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Total: <span className="text-red-300 font-bold">{scanData.total_stuck_sol.toFixed(6)} SOL</span>.{' '}
                                        Tick the checkboxes on any <span className="text-red-300">🔴 STUCK_FUNDS</span> rows below, then use the batch actions panel to refund or resolve them.
                                    </p>
                                </div>
                                {stuckResults.length > 0 && (
                                    <button
                                        onClick={selectAll}
                                        className="flex-shrink-0 text-xs font-semibold text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Select all {stuckResults.length}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Batch progress bar */}
                        <AnimatePresence>
                            {batchRunning && batchAction && (
                                <BatchProgressBar
                                    done={batchDone}
                                    total={batchTotal}
                                    errors={batchErrors}
                                    action={batchAction}
                                    onStop={() => { stopRef.current = true; }}
                                />
                            )}
                            {!batchRunning && batchAction && batchTotal > 0 && (
                                <BatchProgressBar
                                    done={batchDone}
                                    total={batchTotal}
                                    errors={batchErrors}
                                    action={batchAction}
                                    onStop={() => { }}
                                />
                            )}
                        </AnimatePresence>

                        {/* Batch action panel */}
                        <AnimatePresence>
                            {!batchRunning && (
                                <BatchPanel
                                    selectedIds={selectedIds}
                                    allStuck={stuckResults}
                                    onSelectAll={selectAll}
                                    onClearAll={clearAll}
                                    onExecute={executeBatch}
                                    batchRunning={batchRunning}
                                    results={rowStatuses}
                                />
                            )}
                        </AnimatePresence>

                        {/* Filter bar */}
                        <div className="flex flex-wrap gap-3 items-center">
                            {/* Select-all checkbox for stuck rows */}
                            {stuckResults.length > 0 && !batchRunning && (
                                <button
                                    onClick={allStuckSelected ? clearAll : selectAll}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 hover:border-primary/40 px-2.5 py-1.5 rounded-lg transition-colors"
                                >
                                    {allStuckSelected
                                        ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                        : <Square className="h-3.5 w-3.5" />}
                                    {allStuckSelected ? 'Deselect all stuck' : `Select all ${stuckResults.length} stuck`}
                                </button>
                            )}

                            {/* Verdict filter */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                {(['all', 'STUCK_FUNDS', 'ACTIVE_FUNDED', 'DISTRIBUTED', 'PENDING_DEPOSIT', 'RPC_ERROR'] as const).map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setVerdictFilter(v)}
                                        className={cn(
                                            'text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                                            verdictFilter === v
                                                ? 'bg-primary/20 border-primary/40 text-primary'
                                                : 'bg-card/60 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60',
                                        )}
                                    >
                                        {v === 'all' ? 'All' : VERDICT_CONFIG[v].emoji + ' ' + VERDICT_CONFIG[v].label}
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <input
                                    type="text"
                                    placeholder="Search wager ID, match ID, wallet, PDA…"
                                    value={searchText}
                                    onChange={e => setSearchText(e.target.value)}
                                    className="w-full pl-3 pr-8 py-1.5 bg-card border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                {searchText && (
                                    <button onClick={() => setSearchText('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            <span className="text-xs text-muted-foreground ml-auto">
                                Showing {displayResults.length} of {scanData.scanned} scanned
                                {selectedIds.size > 0 && (
                                    <span className="text-primary font-semibold ml-2">· {selectedIds.size} selected</span>
                                )}
                            </span>
                        </div>

                        {/* Table */}
                        {displayResults.length > 0 ? (
                            <div className="glass rounded-2xl border border-border/30 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-border/30 bg-muted/20">
                                                {/* Checkbox header */}
                                                <th className="pl-3 pr-1 py-3 w-8">
                                                    {stuckResults.length > 0 && !batchRunning && (
                                                        <button
                                                            onClick={allStuckSelected ? clearAll : selectAll}
                                                            className="text-muted-foreground hover:text-primary transition-colors"
                                                            title="Toggle all stuck"
                                                        >
                                                            {allStuckSelected
                                                                ? <CheckSquare className="h-4 w-4 text-primary" />
                                                                : someStuckSelected
                                                                    ? <CheckSquare className="h-4 w-4 text-primary/50" />
                                                                    : <Square className="h-4 w-4" />}
                                                        </button>
                                                    )}
                                                </th>
                                                <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Match</th>
                                                <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Game</th>
                                                <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">DB Status</th>
                                                <th
                                                    className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground"
                                                    onClick={() => toggleSort('stake_sol')}
                                                >
                                                    Stake <SortIcon col="stake_sol" />
                                                </th>
                                                <th
                                                    className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground"
                                                    onClick={() => toggleSort('pda_sol')}
                                                >
                                                    PDA SOL <SortIcon col="pda_sol" />
                                                </th>
                                                <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Verdict</th>
                                                <th
                                                    className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground"
                                                    onClick={() => toggleSort('created_at')}
                                                >
                                                    Age <SortIcon col="created_at" />
                                                </th>
                                                <th className="px-3 py-3 w-6" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayResults.map((r, i) => {
                                                const bRes = rowStatuses.get(r.wager_id);
                                                return (
                                                    <ResultRow
                                                        key={r.wager_id}
                                                        r={r}
                                                        idx={i}
                                                        selected={selectedIds.has(r.wager_id)}
                                                        onToggle={toggleRow}
                                                        rowStatus={bRes?.status ?? 'idle'}
                                                        currentAction={batchAction}
                                                        batchRunning={batchRunning}
                                                    />
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                <Filter className="h-10 w-10 mb-3 opacity-20" />
                                <p className="text-sm">No results match the current filter</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Empty state */}
                {!scanData && !loading && !error && (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                        <ScanSearch className="h-14 w-14 mb-4 opacity-20" />
                        <p className="text-sm font-medium">Ready to scan</p>
                        <p className="text-xs mt-1 opacity-60 max-w-sm">
                            Click <span className="text-primary font-semibold">Scan All PDAs</span> to fetch all wager PDAs from the DB,
                            derive their on-chain addresses, and check their live state via Solana RPC.
                        </p>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function PdaScannerPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <PdaScannerContent />
        </Suspense>
    );
}