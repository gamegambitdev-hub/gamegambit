'use client'

import dynamic from 'next/dynamic'

const FeedView = dynamic(
  () => import('@/components/feed/FeedView').then(m => ({ default: m.FeedView })),
  { ssr: false, loading: () => null }
)

export default function FeedPage() {
  return <FeedView />
}