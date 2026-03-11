'use client';

import { Suspense } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion } from 'framer-motion';
import { Scale, Search, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

function DisputesContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDispute, setSelectedDispute] = useState<string | null>(null);

    // Placeholder data - will be replaced with actual data fetching
    const disputes = [
        {
            id: '1',
            wagerId: 'wager-001',
            player1: 'Player1',
            player2: 'Player2',
            game: 'Chess',
            stake: 2.5,
            issue: 'Player claims opponent quit mid-game',
            reportedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
            status: 'open',
        },
        {
            id: '2',
            wagerId: 'wager-003',
            player1: 'Player5',
            player2: 'Player6',
            game: 'Codm',
            stake: 1.5,
            issue: 'Disagreement over final score',
            reportedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            status: 'reviewing',
        },
    ];

    const filteredDisputes = disputes.filter(dispute => {
        const matchesSearch = dispute.id.includes(searchTerm) ||
            dispute.wagerId.includes(searchTerm) ||
            dispute.player1.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dispute.player2.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'reviewing':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'resolved':
                return 'bg-success/20 text-success border-success/30';
            default:
                return 'bg-muted text-muted-foreground border-muted';
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
                        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl p-3">
                            <Scale className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Dispute Resolution</h1>
                            <p className="text-muted-foreground">Review and resolve contested wagers</p>
                        </div>
                    </div>
                </motion.div>

                {/* Search */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20"
                >
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by dispute ID, wager ID, or player..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </motion.div>

                {/* Disputes List */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-4"
                >
                    {filteredDisputes.map((dispute, idx) => (
                        <motion.div
                            key={dispute.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + idx * 0.05 }}
                            onClick={() => setSelectedDispute(selectedDispute === dispute.id ? null : dispute.id)}
                            className="glass rounded-2xl border border-primary/20 cursor-pointer hover:border-primary/40 transition-all overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="h-4 w-4 text-orange-400" />
                                            <h3 className="text-lg font-gaming font-bold text-foreground">Dispute #{dispute.id}</h3>
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${getStatusColor(dispute.status)}`}>
                                                {dispute.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">Wager ID: {dispute.wagerId}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-primary font-semibold">{dispute.stake} SOL</p>
                                        <p className="text-xs text-muted-foreground">{dispute.reportedAt.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4 mb-4 pb-4 border-b border-border/50">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Players</p>
                                        <p className="text-sm text-foreground">{dispute.player1} vs {dispute.player2}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Game</p>
                                        <p className="text-sm text-foreground">{dispute.game}</p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-xs text-muted-foreground mb-2">Issue</p>
                                    <p className="text-sm text-foreground">{dispute.issue}</p>
                                </div>

                                {selectedDispute === dispute.id && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="pt-4 border-t border-border/50 space-y-3"
                                    >
                                        <div className="flex gap-3">
                                            <button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
                                                Force Resolve
                                            </button>
                                            <button className="flex-1 bg-destructive/20 hover:bg-destructive/30 text-destructive font-semibold py-2 px-4 rounded-lg transition-colors">
                                                Force Refund
                                            </button>
                                        </div>
                                        <button className="w-full bg-card border border-border/50 hover:border-primary/50 text-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
                                            View Full Details
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {filteredDisputes.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No disputes found matching your search criteria.
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function DisputesPage() {
    return (
        <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading disputes...</div>}>
            <DisputesContent />
        </Suspense>
    );
}
