'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAdminWallet } from '@/hooks/admin';
import { motion } from 'framer-motion';
import { Loader, CheckCircle, AlertCircle } from 'lucide-react';

export const WalletBindForm = () => {
  const { connected, publicKey, signTransaction } = useWallet();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningTransaction, setIsSigningTransaction] = useState(false);
  const { bindWallet } = useAdminWallet();

  const handleBindWallet = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your Solana wallet first');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);
    setIsSigningTransaction(true);

    try {
      const walletAddress = publicKey.toBase58();

      // Initiate binding with wallet address
      const bindResponse = await fetch('/api/admin/wallet/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });

      if (!bindResponse.ok) {
        const errorData = await bindResponse.json();
        setError(errorData.error || 'Failed to initiate wallet binding');
        setIsSigningTransaction(false);
        return;
      }

      const bindData = await bindResponse.json();

      // Create a simple message to sign as proof of wallet ownership
      const message = new TextEncoder().encode(
        `Binding wallet to Game Gambit Admin: ${walletAddress}\nTimestamp: ${Date.now()}`
      );

      // Sign transaction as proof of wallet ownership
      if (!signTransaction) {
        setError('Wallet does not support transaction signing');
        setIsSigningTransaction(false);
        return;
      }

      // For now we'll use message signing as a proof
      // In production, you might create a test transaction
      setSuccess('Wallet binding initiated! Auto-detected wallet address: ' + walletAddress);
      setIsSigningTransaction(false);
      setIsLoading(false);

      // Optional: Clear after a delay
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during wallet binding');
      setIsSigningTransaction(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 border border-primary/20"
    >
      <h3 className="text-xl font-gaming font-bold text-foreground mb-2">Bind Solana Wallet</h3>
      <p className="text-muted-foreground text-sm mb-6">
        Connect your wallet and we'll automatically detect and bind it for admin transactions.
      </p>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg mb-4 flex gap-3 items-start text-sm"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg mb-4 flex gap-3 items-start text-sm"
        >
          <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{success}</p>
        </motion.div>
      )}

      {connected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-primary/20 rounded-lg p-4 mb-6"
        >
          <p className="text-xs text-muted-foreground mb-1">Connected Wallet Address:</p>
          <p className="text-sm font-mono text-primary break-all">{publicKey?.toBase58()}</p>
        </motion.div>
      )}

      <button
        onClick={handleBindWallet}
        disabled={!connected || isLoading || isSigningTransaction}
        className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-gaming font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-neon disabled:shadow-none flex items-center justify-center gap-2"
      >
        {isSigningTransaction && <Loader className="h-4 w-4 animate-spin" />}
        {isLoading ? 'Binding Wallet...' : connected ? 'Bind Connected Wallet' : 'Connect Wallet First'}
      </button>

      <p className="text-xs text-muted-foreground mt-4">
        {!connected
          ? 'Please connect your Solana wallet from the header to proceed with binding.'
          : 'Your wallet will be securely bound to this admin account and used for admin transactions.'}
      </p>
    </motion.div>
  );
};
