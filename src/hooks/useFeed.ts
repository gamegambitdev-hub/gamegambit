import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRecentWagers } from '@/hooks/useWagers'

export type ReactionType = 'fire' | 'skull' | 'goat' | 'eyes'

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
    { type: 'fire', emoji: '🔥', label: 'Hype' },
    { type: 'skull', emoji: '💀', label: 'Rekt' },
    { type: 'goat', emoji: '🐐', label: 'Goat' },
    { type: 'eyes', emoji: '👀', label: 'Watching' },
]

// ── Fetch reactions for a list of wager IDs ──────────────────────────────────
export function useFeedReactions(wagerIds: string[]) {
    return useQuery({
        queryKey: ['feed-reactions', wagerIds],
        enabled: wagerIds.length > 0,
        staleTime: 15_000,
        queryFn: async () => {
            const db = getSupabaseClient()
            const { data, error } = await db
                .from('feed_reactions')
                .select('wager_id, wallet, reaction_type')
                .in('wager_id', wagerIds)
            if (error) throw error
            // shape: { [wagerId]: { fire: number, skull: number, goat: number, eyes: number } }
            const map: Record<string, Record<ReactionType, number>> = {}
            for (const row of data ?? []) {
                if (!map[row.wager_id]) map[row.wager_id] = { fire: 0, skull: 0, goat: 0, eyes: 0 }
                map[row.wager_id][row.reaction_type as ReactionType]++
            }
            return map
        },
    })
}

// ── Fetch my reactions so we can show which I've already reacted with ─────────
export function useMyReactions(wagerIds: string[], myWallet: string | null) {
    return useQuery({
        queryKey: ['my-reactions', myWallet, wagerIds],
        enabled: !!myWallet && wagerIds.length > 0,
        staleTime: 15_000,
        queryFn: async () => {
            const db = getSupabaseClient()
            const { data, error } = await db
                .from('feed_reactions')
                .select('wager_id, reaction_type')
                .eq('wallet', myWallet!)
                .in('wager_id', wagerIds)
            if (error) throw error
            // shape: Set of "wagerId:reactionType"
            return new Set((data ?? []).map(r => `${r.wager_id}:${r.reaction_type}`))
        },
    })
}

// ── Toggle a reaction (insert or delete) ─────────────────────────────────────
export function useToggleReaction() {
    const qc = useQueryClient()
    const { publicKey } = useWallet()

    return useMutation({
        mutationFn: async ({
            wagerId,
            reactionType,
            alreadyReacted,
            wagerOwnerWallet,
        }: {
            wagerId: string
            reactionType: ReactionType
            alreadyReacted: boolean
            wagerOwnerWallet?: string | null
        }) => {
            const wallet = publicKey?.toBase58()
            if (!wallet) throw new Error('Wallet not connected')
            const db = getSupabaseClient()

            if (alreadyReacted) {
                const { error } = await db
                    .from('feed_reactions')
                    .delete()
                    .eq('wager_id', wagerId)
                    .eq('wallet', wallet)
                    .eq('reaction_type', reactionType)
                if (error) throw error
            } else {
                const { error } = await db
                    .from('feed_reactions')
                    .insert({ wager_id: wagerId, wallet, reaction_type: reactionType })
                if (error) throw error

                // ── Digest notification (max 1 per wager per 10 min) ──────────
                // Only fire if there's a known owner and they're not the reactor
                if (wagerOwnerWallet && wagerOwnerWallet !== wallet) {
                    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
                    const { count } = await db
                        .from('notifications')
                        .select('id', { count: 'exact', head: true })
                        .eq('player_wallet', wagerOwnerWallet)
                        .eq('type', 'feed_reaction')
                        .eq('wager_id', wagerId)
                        .gte('created_at', tenMinsAgo)

                    if ((count ?? 0) === 0) {
                        await db.from('notifications').insert({
                            player_wallet: wagerOwnerWallet,
                            type: 'feed_reaction',
                            title: '\ud83d\udd25 People are reacting to your match',
                            message: 'Your wager is getting attention in the feed',
                            wager_id: wagerId,
                            read: false,
                        })
                    }
                }
            }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['feed-reactions'] })
            qc.invalidateQueries({ queryKey: ['my-reactions'] })
        },
    })
}

// ── Spectator count via Supabase Realtime presence ───────────────────────────
// We track presence per wager channel. Components call this and
// increment/decrement by joining/leaving the channel.
import { useEffect, useState } from 'react'

export function useSpectatorCount(wagerId: string | null) {
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!wagerId) return
        const db = getSupabaseClient()
        const channel = db.channel(`spectators:${wagerId}`, {
            config: { presence: { key: wagerId } },
        })

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()
                setCount(Object.keys(state).length)
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ joined_at: Date.now() })
                }
            })

        return () => {
            channel.unsubscribe()
        }
    }, [wagerId])

    return count
}

// ── Re-export wager hooks the feed needs ─────────────────────────────────────
export { useRecentWagers }