import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';

export interface PlayerSettings {
  pushNotificationsEnabled: boolean;
  moderationRequestsEnabled: boolean;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchSettings(sessionToken: string): Promise<PlayerSettings> {
  const res = await fetch('/api/settings', {
    headers: { 'X-Session-Token': sessionToken },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to load settings');
  return json as PlayerSettings;
}

async function patchSettings(
  updates: Partial<PlayerSettings>,
  sessionToken: string,
): Promise<PlayerSettings> {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': sessionToken,
    },
    body: JSON.stringify(updates),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to update settings');
  return json as PlayerSettings;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * usePlayerSettings
 *
 * Reads and writes the player's push notification and moderation toggles.
 * Uses optimistic updates so the UI feels instant.
 *
 * Usage:
 *   const { settings, isLoading, updateSettings, isUpdating } = usePlayerSettings()
 */
export function usePlayerSettings() {
  const { publicKey } = useWallet();
  const { getSessionToken } = useWalletAuth();
  const queryClient = useQueryClient();

  const walletAddress = publicKey?.toBase58();

  // ── Read ─────────────────────────────────────────────────────────────────
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery<PlayerSettings>({
    queryKey: ['playerSettings', walletAddress],
    queryFn: async () => {
      const token = await getSessionToken();
      if (!token) throw new Error('Wallet verification required');
      return fetchSettings(token);
    },
    enabled: !!walletAddress,
    // Settings change rarely — cache for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Fall back to sensible defaults so the UI is always usable
    placeholderData: {
      pushNotificationsEnabled: true,
      moderationRequestsEnabled: true,
    },
  });

  // ── Write (optimistic) ───────────────────────────────────────────────────
  const { mutateAsync: updateSettings, isPending: isUpdating } = useMutation<
    PlayerSettings,
    Error,
    Partial<PlayerSettings>
  >({
    mutationFn: async (updates) => {
      const token = await getSessionToken();
      if (!token) throw new Error('Wallet verification required');
      return patchSettings(updates, token);
    },
    // Optimistic update — flip the toggle immediately
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['playerSettings', walletAddress] });
      const previous = queryClient.getQueryData<PlayerSettings>(['playerSettings', walletAddress]);
      queryClient.setQueryData<PlayerSettings>(['playerSettings', walletAddress], (old) => ({
        ...((old ?? { pushNotificationsEnabled: true, moderationRequestsEnabled: true }) as PlayerSettings),
        ...updates,
      }));
      return { previous };
    },
    // Roll back on error
    onError: (_err, _updates, context) => {
      const ctx = context as { previous?: PlayerSettings } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(['playerSettings', walletAddress], ctx.previous);
      }
    },
    // Always sync with server response
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['playerSettings', walletAddress] });
      // Also invalidate the main player query so OWN_PROFILE_COLS stays in sync
      queryClient.invalidateQueries({ queryKey: ['player', walletAddress] });
    },
  });

  return {
    settings: settings ?? { pushNotificationsEnabled: true, moderationRequestsEnabled: true },
    isLoading,
    error,
    updateSettings,
    isUpdating,
  };
}