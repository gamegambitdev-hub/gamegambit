'use client';

import { Suspense } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion } from 'framer-motion';
import { Dices, Search, Filter } from 'lucide-react';
import { useState } from 'react';

function WagersContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'created' | 'in_progress' | 'resolved' | 'disputed'>('all');

    // Placeholder data - will be replaced with actual data fetching
    const wagers = [
        {
            id: '1',
            player1: 'Player1',
            player2: 'Player2',
            stake: 2.5,
            game: 'Chess',
            status: 'resolved',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            winner: 'Player1',
        },
        {
            id: '2',
            player1: 'Player3',
            player2: 'Player4',
            stake: 5.0,
            game: 'PUBG',
            status: 'in_progress',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
            winner: null,
        },
        {
            id: '3',
            player1: 'Player5',
            player2: 'Player6',
            stake: 1.5,
            game: 'Codm',
            status: 'disputed',
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
            winner: null,
        },
    ];

    const filteredWagers = wagers.filter(wager => {
        const matchesSearch = wager.id.includes(searchTerm) ||
            wager.player1.toLowerCase().includes(searchTerm.toLowerCase()) ||
            wager.player2.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || wager.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'resolved':
                return 'bg-success/20 text-success';
            case 'in_progress':
                return 'bg-blue-500/20 text-blue-400';
            case 'disputed':
                return 'bg-orange-500/20 text-orange-400';
            default:
                return 'bg-muted text-muted-foreground';
        }
    };

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-3">
                            <Dices className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Wager Management</h1>
                            <p className="text-muted-foreground">Manage all wagers and handle refunds for stuck wagers</p>
                        </div>
                    </div>
                </motion.div>

                {/* Search & Filter */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20 space-y-4"
                >
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by wager ID or player..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                            >
                                <option value="all">All Wagers</option>
                                <option value="created">Created</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="disputed">Disputed</option>
                            </select>
                        </div>
                    </div>
                </motion.div>

                {/* Wagers Table */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass rounded-2xl overflow-hidden border border-primary/20"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border/50 bg-card/50">
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Wager ID</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Players</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Game</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Stake</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Created</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Status</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWagers.map((wager) => (
                                    <tr key={wager.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{wager.id}</td>
                                        <td className="px-6 py-4 text-sm text-foreground">{wager.player1} vs {wager.player2}</td>
                                        <td className="px-6 py-4 text-sm text-foreground">{wager.game}</td>
                                        <td className="px-6 py-4 text-sm text-primary font-semibold">{wager.stake} SOL</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{wager.createdAt.toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(wager.status)}`}>
                                                {wager.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <button className="text-primary hover:text-primary/80 transition-colors">View</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {filteredWagers.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No wagers found matching your search criteria.
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function WagersPage() {
    return (
        <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading wagers...</div>}>
            <WagersContent />
        </Suspense>
    );
}
