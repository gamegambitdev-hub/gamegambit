'use client'

import { UserPlus, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFollows } from '@/hooks/useFollows'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface FollowButtonProps {
    targetWallet: string
    size?: 'sm' | 'default'
    className?: string
}

export function FollowButton({ targetWallet, size = 'sm', className }: FollowButtonProps) {
    const { publicKey } = useWallet()
    const myWallet = publicKey?.toBase58() ?? null
    const [hoveringFollowing, setHoveringFollowing] = useState(false)

    const { isFollowing, follow, unfollow } = useFollows()

    // Don't render on own profile / when no wallet
    if (!myWallet || targetWallet === myWallet) return null

    const following = isFollowing(targetWallet)
    const isLoading = follow.isPending || unfollow.isPending

    const handleFollow = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        follow.mutate(targetWallet, {
            onSuccess: () => toast.success('Following!'),
            onError: () => toast.error('Failed to follow'),
        })
    }

    const handleUnfollow = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        unfollow.mutate(targetWallet, {
            onSuccess: () => toast.success('Unfollowed'),
            onError: () => toast.error('Failed to unfollow'),
        })
    }

    if (!following) {
        return (
            <Button
                variant="outline"
                size={size}
                className={cn('gap-1', className)}
                onClick={handleFollow}
                disabled={isLoading}
            >
                <UserPlus className="h-3.5 w-3.5" />
                Follow
            </Button>
        )
    }

    // Following — show "Following" normally, "Unfollow" on hover
    return (
        <Button
            variant="ghost"
            size={size}
            className={cn(
                'gap-1 transition-colors',
                hoveringFollowing
                    ? 'text-destructive hover:text-destructive hover:bg-destructive/10'
                    : 'text-primary',
                className,
            )}
            onClick={handleUnfollow}
            disabled={isLoading}
            onMouseEnter={() => setHoveringFollowing(true)}
            onMouseLeave={() => setHoveringFollowing(false)}
        >
            <UserCheck className="h-3.5 w-3.5" />
            {hoveringFollowing ? 'Unfollow' : 'Following'}
        </Button>
    )
}