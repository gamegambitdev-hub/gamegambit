// src/hooks/useVoting.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWalletAuth } from './useWalletAuth'
import { invokeSecureWager, Wager } from './useWagers'

export type VoteOutcome = 'agree' | 'disagree' | 'waiting' | 'pending'

/**
 * Derive the current vote state from a wager.
 * - 'waiting'  — neither player has voted yet
 * - 'pending'  — current player voted, waiting for opponent
 * - 'agree'    — both voted, same winner
 * - 'disagree' — both voted, different winners → dispute
 */
export function deriveVoteOutcome(
    wager: Wager | null | undefined,
    myWallet: string
): VoteOutcome {
    if (!wager) return 'waiting'
    const { vote_player_a, vote_player_b } = wager
    const bothVoted = !!vote_player_a && !!vote_player_b
    const iVoted =
        wager.player_a_wallet === myWallet ? !!vote_player_a : !!vote_player_b

    if (!iVoted) return 'waiting'
    if (!bothVoted) return 'pending'
    return vote_player_a === vote_player_b ? 'agree' : 'disagree'
}

export function useSubmitVote() {
    const queryClient = useQueryClient()
    const { getSessionToken } = useWalletAuth()

    return useMutation({
        mutationFn: async ({
            wagerId,
            votedWinner,
        }: {
            wagerId: string
            votedWinner: string
        }) => {
            const sessionToken = await getSessionToken()
            if (!sessionToken) throw new Error('Wallet verification required.')
            const data = await invokeSecureWager<{ wager: Wager }>(
                { action: 'submitVote', wagerId, votedWinner },
                sessionToken
            )
            return data.wager
        },
        onSuccess: (wager) => {
            queryClient.setQueryData(['wagers', wager.id], wager)
            queryClient.invalidateQueries({ queryKey: ['wagers', 'my'] })
        },
    })
}

export function useRetractVote() {
    const queryClient = useQueryClient()
    const { getSessionToken } = useWalletAuth()

    return useMutation({
        mutationFn: async ({ wagerId }: { wagerId: string }) => {
            const sessionToken = await getSessionToken()
            if (!sessionToken) throw new Error('Wallet verification required.')
            const data = await invokeSecureWager<{ wager: Wager }>(
                { action: 'retractVote', wagerId },
                sessionToken
            )
            return data.wager
        },
        onSuccess: (wager) => {
            queryClient.setQueryData(['wagers', wager.id], wager)
            queryClient.invalidateQueries({ queryKey: ['wagers', 'my'] })
        },
    })
}