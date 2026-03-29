// src/hooks/useDisputeGrace.ts
//
// Step 4: Dispute grace period concession.
// useConcede() calls secure-wager 'concedeDispute' action.
// The server validates status === 'disputed', sets grace_conceded_by + grace_conceded_at,
// triggers resolution via process-concession edge function, and logs the event.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeSecureWager, Wager } from './useWagers';
import { useWalletAuth } from './useWalletAuth';

export function useConcede() {
    const queryClient = useQueryClient();
    const { getSessionToken } = useWalletAuth();

    return useMutation({
        mutationFn: async ({ wagerId }: { wagerId: string }) => {
            const sessionToken = await getSessionToken();
            if (!sessionToken) throw new Error('Wallet verification required.');
            const data = await invokeSecureWager<{ wager: Wager }>(
                { action: 'concedeDispute', wagerId },
                sessionToken,
                30_000, // allow time for on-chain resolution
            );
            return data.wager;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wagers'] });
        },
    });
}