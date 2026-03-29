'use client'

/**
 * DisputeGraceModal.tsx  — Step 4
 *
 * Shown to both players immediately when wager.status === 'disputed'
 * and grace_conceded_by is null.
 *
 * Give players a chance to admit they voted wrong before a moderator
 * is pulled in. No countdown is shown — the moderator search runs
 * silently in the background.
 *
 * If either player taps "I was wrong", the wager resolves immediately
 * (no moderator fee, faster payout, honesty logged positively).
 */

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import {
    AlertTriangle, Loader2, ShieldCheck, Handshake, Swords,
} from 'lucide-react'
import { Wager } from '@/hooks/useWagers'
import { useConcede } from '@/hooks/useDisputeGrace'
import { formatSol, GAMES } from '@/lib/constants'
import { PlayerLink } from '@/components/PlayerLink'
import { usePlayerByWallet } from '@/hooks/usePlayer'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisputeGraceModalProps {
    wager: Wager | null
    open: boolean
    onOpenChange: (open: boolean) => void
    currentWallet: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGameName(game: string) {
    switch (game) {
        case 'codm': return GAMES.CODM.name
        case 'pubg': return GAMES.PUBG.name
        case 'free_fire': return GAMES.FREE_FIRE.name
        default: return 'Game'
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DisputeGraceModal({
    wager,
    open,
    onOpenChange,
    currentWallet,
}: DisputeGraceModalProps) {
    const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet ?? null)
    const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet ?? null)
    const concedeMutation = useConcede()
    const [confirmed, setConfirmed] = useState(false)

    if (!wager) return null

    const isPlayerA = wager.player_a_wallet === currentWallet
    const opponentWallet = isPlayerA ? wager.player_b_wallet : wager.player_a_wallet
    const opponentPlayer = isPlayerA ? playerB : playerA
    const opponentLabel = opponentPlayer?.username ?? 'Opponent'
    const gameName = getGameName(wager.game)
    const potSol = formatSol(wager.stake_lamports * 2)

    const handleConcede = async () => {
        if (!wager || concedeMutation.isPending) return
        try {
            await concedeMutation.mutateAsync({ wagerId: wager.id })
            toast.success('Concession recorded — thanks for being honest.')
            onOpenChange(false)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to concede. Try again.')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-md border border-yellow-500/40 bg-background"
                // Non-dismissable while concession is pending
                onPointerDownOutside={concedeMutation.isPending ? (e) => e.preventDefault() : undefined}
                onEscapeKeyDown={concedeMutation.isPending ? (e) => e.preventDefault() : undefined}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-yellow-400">
                        <AlertTriangle className="h-5 w-5" />
                        Result Disputed
                    </DialogTitle>
                </DialogHeader>

                {/* Game info strip */}
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm">
                    <span className="font-medium text-muted-foreground">{gameName}</span>
                    <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                        {potSol} SOL pot
                    </Badge>
                </div>

                {/* Explanation */}
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        You and{' '}
                        {opponentWallet ? (
                            <PlayerLink walletAddress={opponentWallet} username={opponentLabel} className="text-foreground font-medium" />
                        ) : (
                            <span className="font-medium">your opponent</span>
                        )}{' '}
                        voted for different winners. A moderator is being assigned in the background to review the match.
                    </p>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                        If you know you made a mistake —{' '}
                        <span className="text-foreground font-medium">admit it now</span>. Your
                        opponent gets paid out immediately, no moderator fee is taken from the pot,
                        and your honesty is recorded positively.
                    </p>
                </motion.div>

                {/* Concede confirm step */}
                {!confirmed ? (
                    <div className="space-y-3 pt-2">
                        <Button
                            variant="outline"
                            className="w-full border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-400"
                            onClick={() => setConfirmed(true)}
                            disabled={concedeMutation.isPending}
                        >
                            <Handshake className="mr-2 h-4 w-4" />
                            I was wrong — my opponent actually won
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full text-muted-foreground hover:text-foreground"
                            onClick={() => onOpenChange(false)}
                            disabled={concedeMutation.isPending}
                        >
                            <Swords className="mr-2 h-4 w-4" />
                            I stand by my vote — let the moderator decide
                        </Button>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-3 rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-4"
                    >
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">Confirm concession</p>
                                <p className="text-xs text-muted-foreground">
                                    This cannot be undone.{' '}
                                    <span className="font-medium text-foreground">{opponentLabel}</span>{' '}
                                    will receive the full payout immediately.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => setConfirmed(false)}
                                disabled={concedeMutation.isPending}
                            >
                                Go back
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 bg-yellow-500 text-black hover:bg-yellow-400"
                                onClick={handleConcede}
                                disabled={concedeMutation.isPending}
                            >
                                {concedeMutation.isPending ? (
                                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Confirming…</>
                                ) : (
                                    'Yes, confirm concession'
                                )}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </DialogContent>
        </Dialog>
    )
}