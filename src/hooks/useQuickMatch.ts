import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';
import { invokeSecureWager, Wager, GameType } from './useWagers';
import { toast } from 'sonner';

export function useQuickMatch() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async (game?: GameType): Promise<Wager> => {
      if (!publicKey) throw new Error('Wallet not connected');

      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required. Please sign the message to continue.');
      }

      const walletAddress = publicKey.toBase58();

      // Read-only query to find eligible open wagers — safe to do directly
      // via the anon Supabase client (no write, no auth bypass).
      const { getSupabaseClient } = await import('@/integrations/supabase/client');
      const supabase = getSupabaseClient();

      const { data: openWagers, error: fetchError } = await supabase
        .from('wagers')
        .select('id, game, stake_lamports, player_a_wallet, player_b_wallet, status')
        .eq('status', 'created')
        .neq('player_a_wallet', walletAddress)
        .is('player_b_wallet', null);

      if (fetchError) throw fetchError;

      let eligibleWagers = openWagers || [];
      if (game) {
        eligibleWagers = eligibleWagers.filter(w => w.game === game);
      }

      if (eligibleWagers.length === 0) {
        throw new Error(
          game
            ? `No open ${game.toUpperCase()} wagers right now. Try a different game or create one!`
            : 'No open wagers right now. Be the first to create one!'
        );
      }

      // Join via secure-wager using the same invokeSecureWager helper that
      // every other mutation in useWagers.ts uses — ensures X-Session-Token
      // is set correctly on Vercel (the old supabase.functions.invoke call
      // used Authorization: Bearer which the edge function rejected).
      const selectedWager = eligibleWagers[Math.floor(Math.random() * eligibleWagers.length)];

      // BUG-14: SOL balance pre-check before quick match join
      try {
        const balanceLamports = await connection.getBalance(publicKey);
        if (balanceLamports < selectedWager.stake_lamports) {
          const stakeSol = (selectedWager.stake_lamports / 1_000_000_000).toFixed(4);
          const balanceSol = (balanceLamports / 1_000_000_000).toFixed(4);
          throw new Error(
            `Insufficient SOL balance — you need ${stakeSol} SOL to join this wager but only have ${balanceSol} SOL`
          );
        }
      } catch (balanceErr: unknown) {
        // Re-throw our own insufficient balance errors; swallow RPC errors
        // so a temporary RPC failure doesn't block the user from trying
        if (balanceErr instanceof Error && balanceErr.message.includes('Insufficient SOL')) {
          throw balanceErr;
        }
        console.warn('[useQuickMatch] balance check RPC error — proceeding anyway:', balanceErr);
      }

      const result = await invokeSecureWager<{ wager: Wager }>(
        { action: 'join', wagerId: selectedWager.id },
        sessionToken,
      );

      return result.wager;
    },
    onSuccess: (wager) => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
      toast.success(
        `Matched! Joined a ${wager.game.toUpperCase()} wager for ${(wager.stake_lamports / 1_000_000_000).toFixed(4)} SOL`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}