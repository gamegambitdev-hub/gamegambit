'use client';

import { Suspense, useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion } from 'framer-motion';
import { Users as UsersIcon, Search, Loader, ChevronLeft, ChevronRight, Flag, ShieldOff, Shield, AlertTriangle } from 'lucide-react';
import { useAdminUsers } from '@/hooks/admin/useAdminUsers';
import { useWallet } from '@solana/wallet-adapter-react';

function UsersContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned'>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [banReason, setBanReason] = useState('');
    const [flagReason, setFlagReason] = useState('');
    const [showBanDialog, setShowBanDialog] = useState<string | null>(null);
    const [showFlagDialog, setShowFlagDialog] = useState<string | null>(null);
    const { publicKey } = useWallet();

    const {
        users,
        loading,
        error,
        total,
        offset,
        limit,
        fetchUsers,
        nextPage,
        prevPage,
        hasNextPage,
        hasPrevPage,
    } = useAdminUsers();

    const handleSearch = useCallback(() => {
        // fetchUsers supports a search param if getAllUsers is wired for it
        // Falls back to client-side filtering below for now
        fetchUsers(0);
    }, [fetchUsers]);

    const doAction = async (
        action: string,
        playerWallet: string,
        extra: Record<string, string> = {},
        successMsg: string
    ) => {
        if (!publicKey) { setActionError('Connect your wallet first'); return; }
        setActionLoading(playerWallet);
        setActionError(null);
        setActionSuccess(null);
        try {
            const res = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action,
                    adminWallet: publicKey.toBase58(),
                    playerWallet,
                    ...extra,
                }),
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.error || 'Action failed');
            setActionSuccess(successMsg);
            fetchUsers(offset); // refresh current page
            setTimeout(() => setActionSuccess(null), 3000);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    // Client-side filter on top of paginated results
    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.wallet_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
        const matchesFilter =
            filterStatus === 'all' ||
            (filterStatus === 'banned' ? user.is_banned : !user.is_banned);
        return matchesSearch && matchesFilter;
    });

    const truncateWallet = (wallet: string, start = 8, end = 4) =>
        wallet.length <= start + end ? wallet : `${wallet.slice(0, start)}...${wallet.slice(-end)}`;

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return (
        <ProtectedRoute>
            <div className="space-y-6">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-3">
                                <UsersIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-gaming font-bold text-glow">User Management</h1>
                                <p className="text-muted-foreground">
                                    {total > 0 ? `${total} total users` : 'View and manage all users'}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Alerts */}
                {(error || actionError) && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {error || actionError}
                    </motion.div>
                )}
                {actionSuccess && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg">
                        {actionSuccess}
                    </motion.div>
                )}

                {/* Search & Filter */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by wallet or username..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                            className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                        >
                            <option value="all">All Users</option>
                            <option value="active">Active</option>
                            <option value="banned">Banned</option>
                        </select>
                    </div>
                </motion.div>

                {/* Table */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass rounded-2xl overflow-hidden border border-primary/20">

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border/50 bg-card/50">
                                        <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Wallet</th>
                                        <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Username</th>
                                        <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Joined</th>
                                        <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">W / L</th>
                                        <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Earnings</th>
                                        <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Status</th>
                                        <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                                                No users found matching your criteria.
                                            </td>
                                        </tr>
                                    ) : filteredUsers.map((user) => (
                                        <tr key={user.wallet_address}
                                            className="border-b border-border/50 hover:bg-card/50 transition-colors">
                                            <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                                                {truncateWallet(user.wallet_address)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-foreground font-medium">
                                                {user.username || <span className="text-muted-foreground italic">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-muted-foreground">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-foreground">
                                                {/* AdminUser type uses is_banned/is_flagged — stats may not be present */}
                                                {'total_wins' in user
                                                    ? `${(user as any).total_wins ?? 0}W / ${(user as any).total_losses ?? 0}L`
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-primary font-semibold">
                                                {'total_earnings' in user
                                                    ? `${(((user as any).total_earnings ?? 0) / 1_000_000_000).toFixed(4)} SOL`
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${user.is_banned
                                                        ? 'bg-destructive/20 text-destructive'
                                                        : 'bg-success/20 text-success'}`}>
                                                        {user.is_banned ? 'Banned' : 'Active'}
                                                    </span>
                                                    {user.is_flagged && (
                                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full w-fit bg-orange-500/20 text-orange-400">
                                                            Flagged
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex items-center gap-3">
                                                    {/* Ban / Unban */}
                                                    {user.is_banned ? (
                                                        <button
                                                            onClick={() => doAction('unbanPlayer', user.wallet_address, {}, 'Player unbanned')}
                                                            disabled={actionLoading === user.wallet_address}
                                                            title="Unban player"
                                                            className="text-success hover:text-success/80 disabled:opacity-50 transition-colors"
                                                        >
                                                            {actionLoading === user.wallet_address
                                                                ? <Loader className="h-4 w-4 animate-spin" />
                                                                : <ShieldOff className="h-4 w-4" />}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setShowBanDialog(user.wallet_address)}
                                                            disabled={actionLoading === user.wallet_address}
                                                            title="Ban player"
                                                            className="text-destructive hover:text-destructive/80 disabled:opacity-50 transition-colors"
                                                        >
                                                            <Shield className="h-4 w-4" />
                                                        </button>
                                                    )}

                                                    {/* Flag / Unflag */}
                                                    {user.is_flagged ? (
                                                        <button
                                                            onClick={() => doAction('unflagPlayer', user.wallet_address, {}, 'Flag cleared')}
                                                            disabled={actionLoading === user.wallet_address}
                                                            title="Clear flag"
                                                            className="text-orange-400 hover:text-orange-400/80 disabled:opacity-50 transition-colors"
                                                        >
                                                            {actionLoading === user.wallet_address
                                                                ? <Loader className="h-4 w-4 animate-spin" />
                                                                : <Flag className="h-4 w-4 fill-current" />}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setShowFlagDialog(user.wallet_address)}
                                                            disabled={actionLoading === user.wallet_address}
                                                            title="Flag for review"
                                                            className="text-muted-foreground hover:text-orange-400 disabled:opacity-50 transition-colors"
                                                        >
                                                            <Flag className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {total > limit && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages} · {total} users
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={prevPage}
                                    disabled={!hasPrevPage || loading}
                                    className="p-2 rounded-lg bg-card border border-border/50 hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={nextPage}
                                    disabled={!hasNextPage || loading}
                                    className="p-2 rounded-lg bg-card border border-border/50 hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Ban Dialog */}
                {showBanDialog && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowBanDialog(null)}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="glass rounded-2xl p-6 border border-primary/20 w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}>
                            <h2 className="text-xl font-gaming font-bold text-foreground mb-1">Ban Player</h2>
                            <p className="text-xs text-muted-foreground mb-4 font-mono">{showBanDialog}</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-muted-foreground mb-2 block">Reason for ban</label>
                                    <input
                                        type="text"
                                        value={banReason}
                                        onChange={(e) => setBanReason(e.target.value)}
                                        placeholder="Enter ban reason..."
                                        autoFocus
                                        className="w-full px-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => { setShowBanDialog(null); setBanReason(''); }}
                                        className="flex-1 bg-card border border-border/50 hover:border-primary/50 text-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            doAction('banPlayer', showBanDialog, { reason: banReason }, 'Player banned');
                                            setShowBanDialog(null);
                                            setBanReason('');
                                        }}
                                        disabled={!banReason.trim() || actionLoading === showBanDialog}
                                        className="flex-1 bg-destructive hover:bg-destructive/90 disabled:bg-muted text-destructive-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
                                        Confirm Ban
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Flag Dialog */}
                {showFlagDialog && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowFlagDialog(null)}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="glass rounded-2xl p-6 border border-primary/20 w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}>
                            <h2 className="text-xl font-gaming font-bold text-foreground mb-1">Flag for Review</h2>
                            <p className="text-xs text-muted-foreground mb-4 font-mono">{showFlagDialog}</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-muted-foreground mb-2 block">Reason</label>
                                    <input
                                        type="text"
                                        value={flagReason}
                                        onChange={(e) => setFlagReason(e.target.value)}
                                        placeholder="Reason for flagging..."
                                        autoFocus
                                        className="w-full px-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => { setShowFlagDialog(null); setFlagReason(''); }}
                                        className="flex-1 bg-card border border-border/50 hover:border-primary/50 text-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            doAction('flagPlayer', showFlagDialog, { reason: flagReason }, 'Player flagged');
                                            setShowFlagDialog(null);
                                            setFlagReason('');
                                        }}
                                        disabled={!flagReason.trim() || actionLoading === showFlagDialog}
                                        className="flex-1 bg-orange-500 hover:bg-orange-500/90 disabled:bg-muted text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                        Confirm Flag
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

            </div>
        </ProtectedRoute>
    );
}

export default function UsersPage() {
    return (
        <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading users...</div>}>
            <UsersContent />
        </Suspense>
    );
}