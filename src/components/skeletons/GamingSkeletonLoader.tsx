'use client'

// ─────────────────────────────────────────────────────────────────────────────
// GamingSkeletonLoader.tsx
// All skeleton / loading components for the app.
// No new CSS variables — all classes come from globals.css or Tailwind core.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. DashboardPageSkeleton ──────────────────────────────────────────────────
// Mirrors the real dashboard layout. Shown while !walletReady || playerLoading.
// Stat cards stagger left-to-right; match rows stagger top-to-bottom.

export function DashboardPageSkeleton() {
    return (
        <div className="py-8 pb-16">
            <div className="container px-4">

                {/* Header row */}
                <div className="mb-8 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full border-2 border-transparent border-t-primary/60 animate-spin flex-shrink-0"
                            style={{ animationDuration: '1s' }}
                        />
                        <div className="space-y-2">
                            <div className="animate-shimmer h-7 w-52 rounded-md bg-muted" />
                            <div className="animate-shimmer h-3 w-36 rounded-md bg-muted" />
                        </div>
                    </div>
                    <div className="animate-shimmer h-9 w-28 rounded-lg bg-muted flex-shrink-0" />
                </div>

                {/* 4 stat cards — stagger left → right */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="card-gaming p-4 rounded-xl border border-border/50">
                            <div className="flex items-center gap-3">
                                <div
                                    className="animate-shimmer w-10 h-10 rounded-xl bg-muted flex-shrink-0"
                                    style={{ animationDelay: `${i * 70}ms` }}
                                />
                                <div className="space-y-2 flex-1 min-w-0">
                                    <div className="animate-shimmer h-3 w-14 rounded bg-muted" style={{ animationDelay: `${i * 70}ms` }} />
                                    <div className="animate-shimmer h-5 w-20 rounded bg-muted" style={{ animationDelay: `${i * 70}ms` }} />
                                    <div className="animate-shimmer h-2 w-10 rounded bg-muted" style={{ animationDelay: `${i * 70}ms` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left col — match rows stagger top → bottom */}
                    <div className="lg:col-span-2 space-y-3">
                        <div className="card-gaming rounded-xl border border-border/50 p-4">
                            <div className="animate-shimmer h-5 w-36 rounded bg-muted mb-4" />
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0">
                                    <div className="animate-shimmer w-10 h-10 rounded-full bg-muted flex-shrink-0" style={{ animationDelay: `${i * 80}ms` }} />
                                    <div className="animate-shimmer w-8 h-8 rounded-lg bg-muted flex-shrink-0" style={{ animationDelay: `${i * 80}ms` }} />
                                    <div className="flex-1 space-y-2 min-w-0">
                                        <div className="animate-shimmer h-4 w-40 rounded bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
                                        <div className="animate-shimmer h-3 w-24 rounded bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
                                    </div>
                                    <div className="animate-shimmer h-5 w-16 rounded bg-muted flex-shrink-0" style={{ animationDelay: `${i * 80}ms` }} />
                                </div>
                            ))}
                        </div>
                        {/* Performance card */}
                        <div className="card-gaming rounded-xl border border-border/50 p-4">
                            <div className="animate-shimmer h-5 w-28 rounded bg-muted mb-4" />
                            <div className="animate-shimmer h-2 w-full rounded-full bg-muted mb-4" />
                            <div className="grid grid-cols-3 gap-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="text-center p-3 rounded-xl bg-muted/40">
                                        <div className="animate-shimmer h-8 w-10 rounded bg-muted mx-auto mb-1" style={{ animationDelay: `${i * 60}ms` }} />
                                        <div className="animate-shimmer h-3 w-8 rounded bg-muted mx-auto" style={{ animationDelay: `${i * 60}ms` }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right sidebar — arrives after left col */}
                    <div className="space-y-4">
                        <div className="card-gaming rounded-xl border border-border/50 p-4 flex flex-col items-center gap-3">
                            <div className="animate-shimmer w-12 h-12 rounded-full bg-muted" style={{ animationDelay: '120ms' }} />
                            <div className="animate-shimmer h-8 w-16 rounded bg-muted" style={{ animationDelay: '120ms' }} />
                            <div className="animate-shimmer h-3 w-28 rounded bg-muted" style={{ animationDelay: '120ms' }} />
                        </div>
                        <div className="card-gaming rounded-xl border border-border/50 p-4 space-y-3">
                            <div className="animate-shimmer h-5 w-28 rounded bg-muted mb-2" style={{ animationDelay: '180ms' }} />
                            {Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
                                    <div className="animate-shimmer w-6 h-6 rounded bg-muted flex-shrink-0" style={{ animationDelay: `${180 + i * 60}ms` }} />
                                    <div className="flex-1 space-y-1">
                                        <div className="animate-shimmer h-3 w-20 rounded bg-muted" style={{ animationDelay: `${180 + i * 60}ms` }} />
                                        <div className="animate-shimmer h-2 w-14 rounded bg-muted" style={{ animationDelay: `${180 + i * 60}ms` }} />
                                    </div>
                                </div>
                            ))}
                            <div className="animate-shimmer h-8 w-full rounded-lg bg-muted" style={{ animationDelay: '300ms' }} />
                        </div>
                        <div className="card-gaming rounded-xl border border-border/50 p-4 space-y-2">
                            <div className="animate-shimmer h-5 w-24 rounded bg-muted mb-2" style={{ animationDelay: '240ms' }} />
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="animate-shimmer h-9 w-full rounded-lg bg-muted" style={{ animationDelay: `${240 + i * 50}ms` }} />
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

// ── 2. WagerRowsSkeleton ──────────────────────────────────────────────────────
// 3 placeholder rows. SOL amount uses an angular HUD clip-path. Stagger T→B.

export function WagerRowsSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card-gaming rounded-xl border border-border/50 p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <span className="live-pulse flex-shrink-0" />
                            <div
                                className="animate-shimmer w-9 h-9 rounded-full bg-muted flex-shrink-0"
                                style={{ animationDelay: `${i * 70}ms` }}
                            />
                            <div className="space-y-2 min-w-0">
                                <div className="animate-shimmer h-4 w-28 rounded bg-muted" style={{ animationDelay: `${i * 70}ms` }} />
                                <div className="animate-shimmer h-3 w-20 rounded bg-muted" style={{ animationDelay: `${i * 70}ms` }} />
                            </div>
                        </div>
                        {/* Angular HUD amount bar */}
                        <div
                            className="animate-shimmer h-6 w-20 bg-muted flex-shrink-0"
                            style={{
                                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 100%, 8px 100%)',
                                animationDelay: `${i * 70}ms`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}

// ── 3. LeaderboardRowsSkeleton ────────────────────────────────────────────────
// 5 rows with staggered 150ms delays — rows appear to "arrive" one by one.

export function LeaderboardRowsSkeleton() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="card-gaming rounded-xl border border-border/50 p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
                    <div
                        className="animate-shimmer h-5 w-8 rounded bg-muted flex-shrink-0 font-mono"
                        style={{ animationDelay: `${i * 150}ms` }}
                    />
                    <div
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-transparent border-t-primary/40 animate-spin flex-shrink-0"
                        style={{ animationDuration: `${1.2 + i * 0.15}s` }}
                    />
                    <div className="flex-1 min-w-0">
                        <div className="animate-shimmer h-4 w-32 rounded bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
                    </div>
                    <div className="animate-shimmer h-5 w-16 rounded bg-muted flex-shrink-0" style={{ animationDelay: `${i * 150}ms` }} />
                </div>
            ))}
        </div>
    )
}

// ── 4. WinnersSidebarSkeleton ─────────────────────────────────────────────────
// 3 compact rows matching the Recent Winners sidebar.

export function WinnersSidebarSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                    <div className="animate-shimmer w-7 h-7 rounded-lg bg-muted flex-shrink-0" style={{ animationDelay: `${i * 80}ms` }} />
                    <div className="animate-shimmer h-4 flex-1 rounded bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
                    <div className="animate-shimmer h-4 w-14 rounded bg-muted flex-shrink-0" style={{ animationDelay: `${i * 80}ms` }} />
                </div>
            ))}
        </div>
    )
}

// ── 5. ProfilePageSkeleton ────────────────────────────────────────────────────
// Mirrors the profile page: header card (instant) → stat cards (L→R) →
// game account rows (T→B). Used for both !walletReady and isLoading states.

export function ProfilePageSkeleton() {
    return (
        <div className="py-8 pb-16">
            <div className="container px-4 max-w-4xl">

                {/* Profile header card — first thing visible */}
                <div className="card-gaming rounded-xl border border-border/50 p-6 mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        <div
                            className="w-20 h-20 rounded-full border-2 border-transparent border-t-primary/60 animate-spin flex-shrink-0"
                            style={{ animationDuration: '1.1s' }}
                        />
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="animate-shimmer h-7 w-40 rounded-lg bg-muted" />
                                <div className="animate-shimmer h-5 w-24 rounded bg-muted" />
                            </div>
                            <div className="animate-shimmer h-4 w-52 rounded bg-muted" />
                            <div className="flex gap-3 flex-wrap">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="animate-shimmer h-8 w-20 rounded-full bg-muted" style={{ animationDelay: `${i * 60}ms` }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4 stat cards — stagger L→R */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="card-gaming p-4 rounded-xl border border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="animate-shimmer w-9 h-9 rounded-xl bg-muted flex-shrink-0" style={{ animationDelay: `${i * 70}ms` }} />
                                <div className="space-y-2 flex-1 min-w-0">
                                    <div className="animate-shimmer h-3 w-12 rounded bg-muted" style={{ animationDelay: `${i * 70}ms` }} />
                                    <div className="animate-shimmer h-5 w-16 rounded bg-muted" style={{ animationDelay: `${i * 70}ms` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Game account cards — stagger T→B */}
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="card-gaming rounded-xl border border-border/50 p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="animate-shimmer w-10 h-10 rounded-xl bg-muted flex-shrink-0" style={{ animationDelay: `${100 + i * 90}ms` }} />
                                    <div className="space-y-2">
                                        <div className="animate-shimmer h-4 w-24 rounded bg-muted" style={{ animationDelay: `${100 + i * 90}ms` }} />
                                        <div className="animate-shimmer h-3 w-32 rounded bg-muted" style={{ animationDelay: `${100 + i * 90}ms` }} />
                                    </div>
                                </div>
                                <div className="animate-shimmer h-8 w-24 rounded-lg bg-muted flex-shrink-0" style={{ animationDelay: `${100 + i * 90}ms` }} />
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    )
}

// ── 6. MyWagersPageSkeleton ───────────────────────────────────────────────────
// Title → 4 stat cards (L→R) → tab strip → wager rows (T→B).

export function MyWagersPageSkeleton() {
    return (
        <div className="py-8 pb-16">
            <div className="container px-4">

                <div className="mb-8">
                    <div className="animate-shimmer h-8 w-36 rounded-lg bg-muted mb-2" />
                    <div className="animate-shimmer h-4 w-56 rounded bg-muted" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="card-gaming p-4 rounded-xl border border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="animate-shimmer w-9 h-9 rounded-lg bg-muted flex-shrink-0" style={{ animationDelay: `${i * 70}ms` }} />
                                <div className="space-y-2 flex-1 min-w-0">
                                    <div className="animate-shimmer h-3 w-12 rounded bg-muted" style={{ animationDelay: `${i * 70}ms` }} />
                                    <div className="animate-shimmer h-5 w-16 rounded bg-muted" style={{ animationDelay: `${i * 70}ms` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 mb-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-shimmer h-9 w-20 rounded-lg bg-muted" style={{ animationDelay: `${i * 50}ms` }} />
                    ))}
                </div>

                <WagerRowsSkeleton />

            </div>
        </div>
    )
}

// ── 7. ButtonDots ─────────────────────────────────────────────────────────────
// Three bouncing dots. Drop-in swap for <Loader2> inside buttons.

export function ButtonDots() {
    return (
        <span className="flex items-center gap-[3px] h-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <span
                    key={i}
                    className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 120}ms`, animationDuration: '0.8s' }}
                />
            ))}
        </span>
    )
}

// ── 8. SearchArcSpinner ───────────────────────────────────────────────────────
// Tiny 16px arc ring for the search input prefix slot.

export function SearchArcSpinner() {
    return (
        <span
            className="inline-block w-4 h-4 rounded-full border-2 border-transparent border-t-primary animate-spin absolute left-3 top-1/2 -translate-y-1/2"
            style={{ animationDuration: '0.75s' }}
        />
    )
}

// ── 9. SettingsPageSkeleton ───────────────────────────────────────────────────
// Mirrors the settings page layout: page title → notifications card →
// moderation card → account links card. Cards stagger T→B.

export function SettingsPageSkeleton() {
    return (
        <div className="py-8 pb-16">
            <div className="container px-4 max-w-2xl mx-auto space-y-6">

                {/* Page title */}
                <div className="flex items-center gap-3">
                    <div className="animate-shimmer w-6 h-6 rounded bg-muted flex-shrink-0" />
                    <div className="animate-shimmer h-7 w-28 rounded-lg bg-muted" />
                </div>

                {/* Notifications card */}
                <div className="card-gaming rounded-xl border border-border/50 p-6 space-y-5">
                    <div className="animate-shimmer h-5 w-32 rounded bg-muted" style={{ animationDelay: '60ms' }} />
                    {/* Push toggle row */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                            <div className="animate-shimmer h-4 w-40 rounded bg-muted" style={{ animationDelay: '80ms' }} />
                            <div className="animate-shimmer h-3 w-56 rounded bg-muted" style={{ animationDelay: '100ms' }} />
                        </div>
                        <div className="animate-shimmer h-6 w-11 rounded-full bg-muted flex-shrink-0" style={{ animationDelay: '80ms' }} />
                    </div>
                </div>

                {/* Moderation card */}
                <div className="card-gaming rounded-xl border border-border/50 p-6 space-y-5">
                    <div className="animate-shimmer h-5 w-28 rounded bg-muted" style={{ animationDelay: '120ms' }} />
                    {/* Mod toggle row */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                            <div className="animate-shimmer h-4 w-48 rounded bg-muted" style={{ animationDelay: '140ms' }} />
                            <div className="animate-shimmer h-3 w-64 rounded bg-muted" style={{ animationDelay: '160ms' }} />
                            <div className="animate-shimmer h-3 w-52 rounded bg-muted" style={{ animationDelay: '170ms' }} />
                        </div>
                        <div className="animate-shimmer h-6 w-11 rounded-full bg-muted flex-shrink-0" style={{ animationDelay: '140ms' }} />
                    </div>
                </div>

                {/* Account links card */}
                <div className="card-gaming rounded-xl border border-border/50 p-4 space-y-1">
                    <div className="animate-shimmer h-5 w-20 rounded bg-muted mb-3" style={{ animationDelay: '200ms' }} />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="animate-shimmer h-11 w-full rounded-lg bg-muted"
                            style={{ animationDelay: `${200 + i * 50}ms` }}
                        />
                    ))}
                </div>

            </div>
        </div>
    )
}