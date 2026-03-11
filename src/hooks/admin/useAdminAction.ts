import { useState, useCallback } from 'react';
import {
    forceResolveWager,
    forceRefundWager,
    markWagerDisputed,
    banPlayer,
    flagPlayer,
    unbanPlayer,
} from '@/integrations/supabase/admin/actions';
import { useWallet } from '@solana/wallet-adapter-react';

export interface AdminActionResult {
    success: boolean;
    message?: string;
    transactionSignature?: string;
    error?: string;
}

export function useAdminAction() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { publicKey } = useWallet();

    const executeAction = useCallback(
        async (
            actionFn: (adminWallet: string) => Promise<any>,
            actionName: string
        ) => {
            if (!publicKey) {
                setError('Wallet not connected');
                return null;
            }

            setLoading(true);
            setError(null);

            try {
                const result = await actionFn(publicKey.toBase58());
                console.log(`[Admin Action] ${actionName} completed successfully`);
                return result;
            } catch (err) {
                const message = err instanceof Error ? err.message : `Failed to ${actionName}`;
                setError(message);
                console.error(`[Admin Action] Error executing ${actionName}:`, err);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [publicKey]
    );

    const resolve = useCallback(
        async (
            wagerId: string,
            winnerWallet: string,
            notes?: string
        ): Promise<AdminActionResult | null> => {
            if (!publicKey) {
                setError('Wallet not connected');
                return null;
            }

            return executeAction(
                (adminWallet) => forceResolveWager(wagerId, winnerWallet, adminWallet, notes),
                'resolve wager'
            );
        },
        [executeAction, publicKey]
    );

    const refund = useCallback(
        async (
            wagerId: string,
            notes?: string
        ): Promise<AdminActionResult | null> => {
            if (!publicKey) {
                setError('Wallet not connected');
                return null;
            }

            return executeAction(
                (adminWallet) => forceRefundWager(wagerId, adminWallet, notes),
                'refund wager'
            );
        },
        [executeAction, publicKey]
    );

    const markDisputed = useCallback(
        async (
            wagerId: string,
            reason?: string
        ): Promise<AdminActionResult | null> => {
            if (!publicKey) {
                setError('Wallet not connected');
                return null;
            }

            return executeAction(
                (adminWallet) => markWagerDisputed(wagerId, adminWallet, reason),
                'mark wager as disputed'
            );
        },
        [executeAction, publicKey]
    );

    const ban = useCallback(
        async (
            playerWallet: string,
            reason: string
        ): Promise<AdminActionResult | null> => {
            if (!publicKey) {
                setError('Wallet not connected');
                return null;
            }

            return executeAction(
                (adminWallet) => banPlayer(playerWallet, adminWallet, reason),
                'ban player'
            );
        },
        [executeAction, publicKey]
    );

    const flag = useCallback(
        async (
            playerWallet: string,
            reason: string
        ): Promise<AdminActionResult | null> => {
            if (!publicKey) {
                setError('Wallet not connected');
                return null;
            }

            return executeAction(
                (adminWallet) => flagPlayer(playerWallet, adminWallet, reason),
                'flag player'
            );
        },
        [executeAction, publicKey]
    );

    const unban = useCallback(
        async (
            playerWallet: string
        ): Promise<AdminActionResult | null> => {
            if (!publicKey) {
                setError('Wallet not connected');
                return null;
            }

            return executeAction(
                (adminWallet) => unbanPlayer(playerWallet, adminWallet),
                'unban player'
            );
        },
        [executeAction, publicKey]
    );

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        loading,
        error,
        resolve,
        refund,
        markDisputed,
        ban,
        flag,
        unban,
        clearError,
    };
}
