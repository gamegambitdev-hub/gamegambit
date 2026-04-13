'use client'

import { useEffect, useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import {
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { useWalletAuth } from './useWalletAuth'
import { PLATFORM_WALLET_PUBKEY } from '@/lib/solana-config'
import { normalizeSolanaError } from './useSolanaProgram'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SideBetStatus =
    | 'open'
    | 'countered'
    | 'matched'
    | 'expired'
    | 'resolved'
    | 'cancelled'

export interface SideBet {
    id: string
    wager_id: string
    bettor_wallet: string
    backer_wallet: string | null
    backed_player: 'player_a' | 'player_b'
    amount_lamports: number
    status: SideBetStatus
    counter_amount: number | null
    tx_signature: string | null
    created_at: string
    matched_at: string | null
    expires_at: string | null
    resolved_at: string | null
}

// ── Query + Realtime ──────────────────────────────────────────────────────────

export function useSideBets(wagerId: string | null) {
    const queryClient = useQueryClient()
    const supabase = getSupabaseClient()

    const query = useQuery<SideBet[]>({
        queryKey: ['side_bets', wagerId],
        queryFn: async () => {
            if (!wagerId) return []
            const { data, error } = await supabase
                .from('spectator_bets')
                .select('*')
                .eq('wager_id', wagerId)
                .order('created_at', { ascending: false })
            if (error) throw error
            return (data ?? []) as SideBet[]
        },
        enabled: !!wagerId,
        staleTime: 10_000,
    })

    // Realtime subscription
    useEffect(() => {
        if (!wagerId) return
        let sub: any = null

        try {
            sub = supabase
                .channel(`side_bets:${wagerId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'spectator_bets',
                        filter: `wager_id=eq.${wagerId}`,
                    },
                    () => {
                        queryClient.invalidateQueries({ queryKey: ['side_bets', wagerId] })
                    }
                )
                .subscribe()
        } catch {
            // supabase not configured
        }

        return () => { sub?.unsubscribe() }
    }, [wagerId, queryClient, supabase])

    return query
}

// ── SOL transfer helper ───────────────────────────────────────────────────────

async function sendSolToPlatform(
    publicKey: PublicKey,
    sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>,
    connection: any,
    lamports: number
): Promise<string> {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

    const tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(PLATFORM_WALLET_PUBKEY),
            lamports,
        })
    )
    tx.recentBlockhash = blockhash
    tx.feePayer = publicKey

    const signature = await sendTransaction(tx, connection, {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
    })

    await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
    )
    return signature
}

// ── Place bet ─────────────────────────────────────────────────────────────────

export function usePlaceSideBet(wagerId: string) {
    const { publicKey, sendTransaction } = useWallet()
    const { connection } = useConnection()
    const { getSessionToken } = useWalletAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            backedPlayer,
            amountLamports,
        }: {
            backedPlayer: 'player_a' | 'player_b'
            amountLamports: number
        }) => {
            if (!publicKey || !sendTransaction) throw new Error('Wallet not connected')

            toast.info('Sending SOL to platform wallet…')
            const txSig = await sendSolToPlatform(
                publicKey,
                sendTransaction,
                connection,
                amountLamports
            )

            const token = await getSessionToken()
            if (!token) throw new Error('Session expired — reconnect wallet')

            const supabase = getSupabaseClient()
            const { data, error } = await supabase.functions.invoke('secure-bet', {
                body: {
                    action: 'place',
                    wagerId,
                    backedPlayer,
                    amountLamports,
                    txSignature: txSig,
                },
                headers: { 'X-Session-Token': token },
            })

            if (error || data?.error) throw new Error(data?.error ?? error?.message)
            return data
        },
        onSuccess: () => {
            toast.success('Bet placed! 🎲')
            queryClient.invalidateQueries({ queryKey: ['side_bets', wagerId] })
        },
        onError: (err: Error) => {
            const msg = normalizeSolanaError(err)
            toast.error('Failed to place bet', { description: msg })
        },
    })
}

// ── Counter bet ───────────────────────────────────────────────────────────────

export function useCounterSideBet(wagerId: string) {
    const { getSessionToken } = useWalletAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            betId,
            counterAmountLamports,
        }: {
            betId: string
            counterAmountLamports: number
        }) => {
            const token = await getSessionToken()
            if (!token) throw new Error('Session expired')

            const supabase = getSupabaseClient()
            const { data, error } = await supabase.functions.invoke('secure-bet', {
                body: { action: 'counter', betId, counterAmountLamports },
                headers: { 'X-Session-Token': token },
            })

            if (error || data?.error) throw new Error(data?.error ?? error?.message)
            return data
        },
        onSuccess: () => {
            toast.success('Counter-offer sent')
            queryClient.invalidateQueries({ queryKey: ['side_bets', wagerId] })
        },
        onError: (err: Error) => {
            toast.error('Counter failed', { description: err.message })
        },
    })
}

// ── Accept bet ────────────────────────────────────────────────────────────────

export function useAcceptSideBet(wagerId: string) {
    const { publicKey, sendTransaction } = useWallet()
    const { connection } = useConnection()
    const { getSessionToken } = useWalletAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            betId,
            amountLamports,
        }: {
            betId: string
            amountLamports: number
        }) => {
            if (!publicKey || !sendTransaction) throw new Error('Wallet not connected')

            toast.info('Sending SOL to platform wallet…')
            const txSig = await sendSolToPlatform(
                publicKey,
                sendTransaction,
                connection,
                amountLamports
            )

            const token = await getSessionToken()
            if (!token) throw new Error('Session expired')

            const supabase = getSupabaseClient()
            const { data, error } = await supabase.functions.invoke('secure-bet', {
                body: { action: 'accept', betId, txSignature: txSig },
                headers: { 'X-Session-Token': token },
            })

            if (error || data?.error) throw new Error(data?.error ?? error?.message)
            return data
        },
        onSuccess: () => {
            toast.success('Bet matched! Good luck 🍀')
            queryClient.invalidateQueries({ queryKey: ['side_bets', wagerId] })
        },
        onError: (err: Error) => {
            const msg = normalizeSolanaError(err)
            toast.error('Accept failed', { description: msg })
        },
    })
}

// ── Cancel bet ────────────────────────────────────────────────────────────────

export function useCancelSideBet(wagerId: string) {
    const { getSessionToken } = useWalletAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ betId }: { betId: string }) => {
            const token = await getSessionToken()
            if (!token) throw new Error('Session expired')

            const supabase = getSupabaseClient()
            const { data, error } = await supabase.functions.invoke('secure-bet', {
                body: { action: 'cancel', betId },
                headers: { 'X-Session-Token': token },
            })

            if (error || data?.error) throw new Error(data?.error ?? error?.message)
            return data
        },
        onSuccess: () => {
            toast.success('Bet cancelled — SOL refunded')
            queryClient.invalidateQueries({ queryKey: ['side_bets', wagerId] })
        },
        onError: (err: Error) => {
            toast.error('Cancel failed', { description: err.message })
        },
    })
}