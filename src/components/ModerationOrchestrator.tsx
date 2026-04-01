'use client';

// src/components/ModerationOrchestrator.tsx
//
// Mounts once inside Providers (inside GameEventProvider).
// Shows the moderation popup and panel at the right time.
//
// Two signal sources — both must work:
//   1. Realtime INSERT from GameEventContext  → catches the initial assignment live
//   2. useActiveModerationRequest poll (5s)   → restores state after page refresh
//
// Bug 1 fix: the original only used source 1. A moderator who accepted and then
// refreshed would lose panelRequest (local state reset) and never see the panel
// again, silently burning their 30-minute decision window.
//
// Flow:
//   pending  → show ModerationRequestModal (30s popup)
//   accepted → show ModerationPanel (30-min workflow)
//   any other status → render nothing

import { useState, useEffect } from 'react';
import { useGameEvents } from '@/contexts/GameEventContext';
import { useActiveModerationRequest } from '@/hooks/useModeration';
import { ModerationRequestModal } from '@/components/ModerationRequestModal';
import { ModerationPanel } from '@/components/ModerationPanel';
import type { ModerationRequest } from '@/hooks/useModeration';

export function ModerationOrchestrator() {
    const { activeModerationRequest, clearModerationRequest } = useGameEvents();

    // Polling fallback — catches state after page refresh or missed Realtime events.
    // Returns null when no active request exists, so it's always safe to read.
    const { data: polledRequest } = useActiveModerationRequest();

    // panelRequest is set when the user accepts, persisted for the session.
    const [panelRequest, setPanelRequest] = useState<ModerationRequest | null>(null);

    // ── Restore panel after page refresh ──────────────────────────────────────
    // If the poll finds an 'accepted' request and the panel isn't already open,
    // the user must have refreshed mid-session. Re-open the panel immediately.
    useEffect(() => {
        if (polledRequest?.status === 'accepted' && !panelRequest) {
            setPanelRequest(polledRequest);
        }
        // Only re-run when the request id or status actually changes — not on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [polledRequest?.id, polledRequest?.status]);

    // ── Derive what to show ───────────────────────────────────────────────────
    // Realtime event takes priority (it has the freshest object).
    // Poll is the fallback for refresh recovery or missed events.
    const effectiveRequest: ModerationRequest | null =
        activeModerationRequest ?? polledRequest ?? null;

    // Show the popup only for 'pending' requests when the panel isn't already open.
    // This prevents re-showing the popup if the user somehow gets a second Realtime
    // event for the same request they already accepted.
    const showPopup =
        !!effectiveRequest &&
        effectiveRequest.status === 'pending' &&
        !panelRequest;

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleAccepted() {
        // Transition: popup → panel.
        // Prefer the Realtime object (has .status freshly set by accept API);
        // fall back to polledRequest if Realtime already cleared.
        const req = activeModerationRequest ?? polledRequest;
        if (req) setPanelRequest(req);
        clearModerationRequest();
    }

    function handlePopupDismissed() {
        // User declined or the 30s timer expired.
        clearModerationRequest();
    }

    function handlePanelClose() {
        setPanelRequest(null);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            {showPopup && effectiveRequest && (
                <ModerationRequestModal
                    request={effectiveRequest}
                    onAccepted={handleAccepted}
                    onDismissed={handlePopupDismissed}
                />
            )}
            {panelRequest && (
                <ModerationPanel
                    request={panelRequest}
                    onClose={handlePanelClose}
                />
            )}
        </>
    );
}