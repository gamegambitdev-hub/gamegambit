// src/app/wager/[id]/layout.tsx
// Server component — handles dynamic metadata for the spectator page
// (page.tsx is 'use client' so metadata must live here instead)

import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

function getGameName(game: string): string {
    switch (game) {
        case 'chess': return 'Chess'
        case 'codm': return 'Call of Duty Mobile'
        case 'pubg': return 'PUBG Mobile'
        case 'free_fire': return 'Free Fire'
        default: return game
    }
}

function getGameIcon(game: string): string {
    switch (game) {
        case 'chess': return '♟'
        case 'codm': return '🎯'
        case 'pubg': return '🔫'
        case 'free_fire': return '🔥'
        default: return '🎮'
    }
}

function formatSol(lamports: number): string {
    return (lamports / 1_000_000_000).toFixed(2)
}

function truncate(wallet: string): string {
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

export async function generateMetadata(
    { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
    const { id } = await params

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thegamegambit.vercel.app'

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data: wager } = await supabase
            .from('wagers')
            .select('game, stake_lamports, status, player_a_wallet, player_b_wallet, winner_wallet, match_id')
            .eq('id', id)
            .single()

        if (!wager) throw new Error('not found')

        // Fetch player names
        const [{ data: pA }, { data: pB }] = await Promise.all([
            supabase
                .from('players')
                .select('username')
                .eq('wallet_address', wager.player_a_wallet)
                .single(),
            wager.player_b_wallet
                ? supabase
                    .from('players')
                    .select('username')
                    .eq('wallet_address', wager.player_b_wallet)
                    .single()
                : Promise.resolve({ data: null }),
        ])

        const nameA = pA?.username ?? truncate(wager.player_a_wallet)
        const nameB = wager.player_b_wallet
            ? (pB?.username ?? truncate(wager.player_b_wallet))
            : 'Open challenge'

        const gameName = getGameName(wager.game)
        const icon = getGameIcon(wager.game)
        const stake = formatSol(wager.stake_lamports)
        const url = `${baseUrl}/wager/${id}`

        const isResolved = wager.status === 'resolved'
        const winnerName = isResolved && wager.winner_wallet
            ? (wager.winner_wallet === wager.player_a_wallet ? nameA : nameB)
            : null

        const title = winnerName
            ? `${winnerName} won ${formatSol(wager.stake_lamports * 2 * 0.9)} SOL on GameGambit`
            : `${icon} ${nameA} vs ${nameB} — ${stake} SOL ${gameName} Wager`

        const description = winnerName
            ? `${nameA} vs ${nameB} · ${gameName} · ${stake} SOL each · Winner: ${winnerName} 👑`
            : `${nameA} vs ${nameB} · ${stake} SOL staked each · ${gameName} on GameGambit`

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                url,
                siteName: 'GameGambit',
                images: [
                    {
                        url: `${url}/opengraph-image`,
                        width: 1200,
                        height: 630,
                        alt: title,
                    },
                ],
                type: 'website',
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
                images: [`${url}/opengraph-image`],
                site: '@gamegambit',
            },
        }
    } catch {
        // Fallback if wager not found or Supabase unavailable
        return {
            title: 'GameGambit — Wager',
            description: 'Watch this wager live on GameGambit. Skill-based wagering on Solana.',
            openGraph: {
                title: 'GameGambit — Live Wager',
                description: 'Watch this wager live on GameGambit. Skill-based wagering on Solana.',
                siteName: 'GameGambit',
                images: [{ url: `${baseUrl}/og-image.png`, width: 1200, height: 630 }],
                type: 'website',
            },
            twitter: {
                card: 'summary_large_image',
                title: 'GameGambit — Live Wager',
                description: 'Watch this wager live on GameGambit.',
                site: '@gamegambit',
            },
        }
    }
}

export default function WagerLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}