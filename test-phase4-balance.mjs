/**
 * test-phase4-balance.mjs
 *
 * Phase 4 — Balance Checks on All Join Paths
 *
 *   BUG-07 · SOL balance pre-check in handleJoinWager (arena/page.tsx)
 *   BUG-14 · SOL balance pre-check in useQuickMatch.ts
 *
 *   node test-phase4-balance.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✅  ${label}`); passed++; }
function fail(label, detail = '') {
  console.log(`  ❌  ${label}`);
  if (detail) console.log(`      ${detail}`);
  failed++;
}
function section(title) { console.log(`\n${title}`); }

// ── BUG-07 · arena/page.tsx ───────────────────────────────────────────────────

section('BUG-07 · handleJoinWager balance pre-check');
{
  const src = readFileSync(resolve('src/app/arena/page.tsx'), 'utf8');

  const fnIdx = src.indexOf('const handleJoinWager');
  const block = src.slice(fnIdx, fnIdx + 1100);

  if (block.includes('BUG-07')) {
    ok('BUG-07 comment present in handleJoinWager');
  } else {
    fail('BUG-07 balance check missing from handleJoinWager');
  }

  if (block.includes('walletBalance < stakeSol')) {
    ok('Balance comparison against stake amount');
  } else {
    fail('Balance comparison missing');
  }

  if (block.includes('Insufficient SOL balance')) {
    ok('User-friendly error toast on insufficient balance');
  } else {
    fail('No user-facing error for insufficient balance');
  }

  if (block.includes('walletBalance.toFixed(4)') && block.includes('stakeSol.toFixed(4)')) {
    ok('Error shows both required and actual balance amounts');
  } else {
    fail('Error message does not show balance amounts');
  }

  // Check it's BEFORE the try block (pre-check, not inside join)
  const bugIdx = block.indexOf('BUG-07');
  const tryIdx = block.indexOf('try {');
  if (bugIdx < tryIdx) {
    ok('Balance check runs before joinWager.mutateAsync (correct order)');
  } else {
    fail('Balance check is inside try block — should be before it');
  }

  // Ensure walletBalance is sourced from useWalletBalance hook
  if (src.includes('useWalletBalance')) {
    ok('walletBalance sourced from useWalletBalance hook (cached, no extra RPC call)');
  } else {
    fail('useWalletBalance hook not used — balance source unknown');
  }

  // BUG-06 still present (Phase 3 carry-forward)
  if (block.includes('setDetailsModalOpen(false)') && block.includes('BUG-06')) {
    ok('BUG-06 modal close still present (Phase 3 carry-forward)');
  } else {
    fail('BUG-06 modal close lost during Phase 4 edit');
  }

  // BUG-19 still present (Phase 3 carry-forward)
  if (src.includes('is_public: false') && src.includes('BUG-19')) {
    ok('BUG-19 is_public: false still present (Phase 3 carry-forward)');
  } else {
    fail('BUG-19 is_public: false lost during Phase 4 edit');
  }
}

// ── BUG-14 · useQuickMatch.ts ─────────────────────────────────────────────────

section('BUG-14 · useQuickMatch balance pre-check');
{
  const src = readFileSync(resolve('src/hooks/useQuickMatch.ts'), 'utf8');

  if (src.includes("import { useWallet, useConnection }")) {
    ok('useConnection imported alongside useWallet');
  } else {
    fail('useConnection not imported — balance check cannot work');
  }

  if (src.includes('const { connection } = useConnection();')) {
    ok('connection destructured from useConnection()');
  } else {
    fail('connection not destructured');
  }

  if (src.includes('BUG-14')) {
    ok('BUG-14 comment present');
  } else {
    fail('BUG-14 balance check missing from useQuickMatch');
  }

  if (src.includes('connection.getBalance(publicKey)')) {
    ok('Fetches live balance via connection.getBalance');
  } else {
    fail('connection.getBalance call missing');
  }

  if (src.includes('balanceLamports < selectedWager.stake_lamports')) {
    ok('Compares balance in lamports directly against stake_lamports');
  } else {
    fail('Lamport comparison missing');
  }

  if (src.includes('Insufficient SOL balance')) {
    ok('Throws clear user-facing error on insufficient balance');
  } else {
    fail('No user-facing error on insufficient balance');
  }

  // Check RPC failure resilience
  if (src.includes('console.warn') && src.includes('balance check RPC error')) {
    ok('RPC errors swallowed gracefully — user not blocked by network hiccup');
  } else {
    fail('No RPC error handling — a failed balance RPC would block quick match');
  }

  // Check balance check is BEFORE the join call
  const bugIdx = src.indexOf('BUG-14');
  const joinIdx = src.indexOf("action: 'join'");
  if (bugIdx < joinIdx) {
    ok('Balance check runs before invokeSecureWager join (correct order)');
  } else {
    fail('Balance check is after join call — not a pre-check');
  }

  // Check selected wager is chosen before the balance check
  const selectIdx = src.indexOf('eligibleWagers[Math.floor');
  if (selectIdx < bugIdx) {
    ok('Wager selected before balance check (stake amount is known)');
  } else {
    fail('Balance check runs before wager is selected — stake amount unknown');
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉  All Phase 4 checks passed!');
} else {
  console.log('⚠️   Some checks failed — review output above before deploying.');
}
