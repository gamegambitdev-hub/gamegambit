'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader, CheckCircle } from 'lucide-react';
import { useAdminAction } from '@/hooks/admin/useAdminAction';

export interface RefundDialogProps {
    isOpen: boolean;
    onClose: () => void;
    wagerId: string;
    player1: string;
    player2: string;
    stake: number;
    onRefundSuccess?: () => void;
}

export function RefundDialog({
    isOpen,
    onClose,
    wagerId,
    player1,
    player2,
    stake,
    onRefundSuccess,
}: RefundDialogProps) {
    const [notes, setNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const { refund, loading, error, clearError } = useAdminAction();

    const handleRefund = async () => {
        clearError();
        const result = await refund(wagerId, notes);

        if (result?.success) {
            setSubmitted(true);
            setTimeout(() => {
                setSubmitted(false);
                onClose();
                onRefundSuccess?.();
            }, 2000);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative z-10 glass rounded-2xl p-6 border border-primary/20 max-w-md w-full mx-4 space-y-6"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-gaming font-bold text-glow">Refund Wager</h2>
                            <button
                                onClick={onClose}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        {!submitted ? (
                            <>
                                {/* Wager Details */}
                                <div className="space-y-4 bg-card/50 rounded-xl p-4 border border-border/50">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Wager ID</span>
                                        <span className="font-mono text-sm text-primary">{wagerId}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Players</span>
                                        <span className="text-sm text-foreground">{player1} vs {player2}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-border/50 pt-4">
                                        <span className="text-muted-foreground">Refund Amount</span>
                                        <span className="font-semibold text-primary">{stake} SOL</span>
                                    </div>
                                </div>

                                {/* Warning */}
                                <div className="flex gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                                    <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0" />
                                    <p className="text-sm text-orange-200">
                                        This action will refund the full stake to both players' wallets. This cannot be undone.
                                    </p>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        Reason for Refund (optional)
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="e.g., Technical issue detected, stuck wager, player request..."
                                        className="w-full px-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground resize-none"
                                        rows={3}
                                        disabled={loading}
                                    />
                                </div>

                                {/* Error */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex gap-2 items-start text-sm"
                                    >
                                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <p>{error}</p>
                                    </motion.div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={onClose}
                                        disabled={loading}
                                        className="flex-1 bg-card border border-border/50 hover:border-primary/50 text-foreground font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleRefund}
                                        disabled={loading}
                                        className="flex-1 bg-destructive hover:bg-destructive/90 disabled:bg-muted text-destructive-foreground font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        {loading && <Loader className="h-4 w-4 animate-spin" />}
                                        {loading ? 'Processing...' : 'Confirm Refund'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* Success State */
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center gap-4 py-8"
                            >
                                <CheckCircle className="h-16 w-16 text-success animate-pulse" />
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-gaming font-bold text-foreground">Refund Processed</h3>
                                    <p className="text-muted-foreground text-sm">
                                        Wager {wagerId} has been successfully refunded
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
