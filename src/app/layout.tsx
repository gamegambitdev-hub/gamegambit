import type { Metadata, Viewport } from 'next'
import { Inter, Orbitron } from 'next/font/google'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/landing/Footer'
import { UsernameEnforcer } from '@/components/UsernameEnforcer'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
})

export const metadata: Metadata = {
  title: 'Game Gambit | Competitive Gaming Wagers on Solana',
  description: 'Challenge opponents, stake SOL, and prove your skills in competitive gaming matches. Built on Solana for instant, secure transactions.',
  keywords: ['gaming', 'wagers', 'solana', 'competitive', 'esports', 'chess', 'codm', 'pubg', 'free fire'],
  authors: [{ name: 'Game Gambit Team' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Game Gambit',
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Game Gambit | Competitive Gaming Wagers on Solana',
    description: 'Challenge opponents and stake SOL in competitive gaming matches. Chess, CODM, PUBG, Free Fire — all live on Solana.',
    type: 'website',
    images: [
      {
        url: '/og-banner.png',
        width: 1200,
        height: 630,
        alt: 'Game Gambit — Competitive Gaming Wagers on Solana',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Game Gambit | Competitive Gaming Wagers on Solana',
    description: 'Stake SOL. Prove your skills. Win on-chain. Chess, CODM, PUBG, Free Fire.',
    images: ['/og-banner.png'],
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#9945FF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  colorScheme: 'dark',
}

// ── Shell rendered for every non-admin route ──────────────────────────────────
// This is a server component so we read the pathname via the children slot trick.
// We can't use usePathname() here (server component), so we use a client
// boundary component that reads the pathname and conditionally renders the shell.
import { PublicShell } from '@/components/layout/PublicShell'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${orbitron.variable} font-sans`}>
        <Providers>
          <PublicShell>
            {children}
          </PublicShell>
        </Providers>
      </body>
    </html>
  )
}