/**
 * test-phase1-errors.mjs
 *
 * Phase 1 — Error Handling & Observability Tests
 *
 * Tests what CAN be verified without a real wallet or on-chain state:
 *   ERR-01 · normalizeSolanaError catch-all
 *   ERR-05 · All 14 mutations in useWagers have onError handlers (static check)
 *   ERR-06 · useCreateWagerOnChain / useJoinWagerOnChain have toast in onError
 *   ERR-07 · Dev-only console.log guards in useSolanaProgram
 *   SEC-09 · secure-wager edge function never leaks raw DB error to client
 *
 * Run AFTER `npm run dev` is running in another terminal:
 *   node test-phase1-errors.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vqgtwalwvalbephvpxap.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅  ${label}`);
  passed++;
}

function fail(label, detail = '') {
  console.log(`  ❌  ${label}`);
  if (detail) console.log(`      ${detail}`);
  failed++;
}

function section(title) {
  console.log(`\n${title}`);
}

// ── Static file checks (no server needed) ────────────────────────────────────

section('ERR-01 · normalizeSolanaError catch-all');
{
  const src = readFileSync(resolve('src/hooks/useSolanaProgram.ts'), 'utf8');
  if (src.includes("return 'Transaction failed — please try again.'")) {
    ok('catch-all return present in normalizeSolanaError');
  } else {
    fail('catch-all missing — normalizeSolanaError still returns raw msg');
  }
  // Verify old raw return is gone
  const lines = src.split('\n');
  const rawReturn = lines.find(l => l.trim() === 'return msg;' && !l.includes('//'));
  if (!rawReturn) {
    ok('raw "return msg" removed from normalizeSolanaError');
  } else {
    fail('raw "return msg" still present — catch-all not applied');
  }
}

section('ERR-05 · All 14 mutations in useWagers have onError handlers');
{
  const src = readFileSync(resolve('src/hooks/useWagers.ts'), 'utf8');

  const mutations = [
    'useCreateWager', 'useJoinWager', 'useSubmitVote', 'useEditWager',
    'useDeleteWager', 'useSetReady', 'useStartGame', 'useCheckGameComplete',
    'useCancelWager', 'useMarkGameComplete', 'useSubmitGameVote',
    'useRetractVote', 'useFinalizeVote', 'useDeclineChallenge',
  ];

  const toastImported = src.includes("import { toast } from 'sonner'");
  toastImported ? ok('toast imported from sonner') : fail('toast NOT imported in useWagers.ts');

  let allHaveOnError = true;
  for (const fn of mutations) {
    const fnIdx = src.indexOf(`export function ${fn}(`);
    if (fnIdx === -1) { fail(`${fn} not found in file`); allHaveOnError = false; continue; }
    const fnBody = src.slice(fnIdx, fnIdx + 1500);
    if (!fnBody.includes('onError')) {
      fail(`${fn} missing onError handler`);
      allHaveOnError = false;
    }
    if (!fnBody.includes('toast.error')) {
      fail(`${fn} onError does not call toast.error`);
      allHaveOnError = false;
    }
    if (!fnBody.includes('console.error')) {
      fail(`${fn} onError does not call console.error`);
      allHaveOnError = false;
    }
  }
  if (allHaveOnError) ok('All 14 mutations have onError with toast + console.error');
}

section('ERR-06 · useCreateWagerOnChain / useJoinWagerOnChain toast on error');
{
  const src = readFileSync(resolve('src/hooks/useSolanaProgram.ts'), 'utf8');

  for (const fn of ['createWager', 'joinWager']) {
    const label = fn === 'createWager' ? 'useCreateWagerOnChain' : 'useJoinWagerOnChain';
    const marker = `[${fn}] onError`;
    const idx = src.indexOf(marker);
    if (idx === -1) { fail(`${label}: onError log marker not found`); continue; }
    const block = src.slice(idx, idx + 300);
    if (block.includes("toast.error('Deposit failed'")) {
      ok(`${label}: toast.error('Deposit failed') present`);
    } else {
      fail(`${label}: toast.error missing in onError`);
    }
    if (block.includes("msg !== 'already_deposited'")) {
      ok(`${label}: already_deposited guard — no toast for idempotent path`);
    } else {
      fail(`${label}: missing already_deposited guard in onError`);
    }
  }
}

section('ERR-07 · Dev-only console.log guards in useSolanaProgram');
{
  const src = readFileSync(resolve('src/hooks/useSolanaProgram.ts'), 'utf8');
  const devGuards = (src.match(/process\.env\.NODE_ENV === 'development'/g) || []).length;
  if (devGuards >= 3) {
    ok(`${devGuards} NODE_ENV === 'development' guards found`);
  } else {
    fail(`Only ${devGuards} dev guards found — expected at least 3`);
  }
  // Verify the noisy logs ARE inside guards, not loose
  const looseBlockhash = src.match(/(?<!NODE_ENV.*)\n\s*console\.log\('\[sendAndConfirmViaAdapter\] fetching/);
  if (!looseBlockhash) {
    ok('blockhash log is inside dev guard (not loose)');
  } else {
    fail('blockhash console.log is still outside NODE_ENV guard');
  }
}

section('SEC-09 · secure-wager: no raw DB error leaks to client (static check)');
{
  const src = readFileSync(resolve('supabase/functions/secure-wager/actions.ts'), 'utf8');

  // Check for the original patterns that leaked raw error objects
  const rawLeaks = [
    "return respond({ error: updateErr.message }",
    "return respond({ error: error.message }",
  ];
  let hasLeak = false;
  for (const pattern of rawLeaks) {
    if (src.includes(pattern)) {
      fail(`Raw error leak found: ${pattern}`);
      hasLeak = true;
    }
  }
  if (!hasLeak) ok('No raw DB error .message leaks to client');

  // Check that all 500 responds have a preceding console.error
  const fiveHundreds = (src.match(/return respond\(\{ error:.*\}, 500\)/g) || []).length;
  const serverLogs = (src.match(/console\.error\('\[actions\]/g) || []).length;
  if (serverLogs >= fiveHundreds) {
    ok(`All ${fiveHundreds} server error paths have console.error logging`);
  } else {
    fail(`${fiveHundreds} 500 responds but only ${serverLogs} console.error calls — some paths unlogged`);
  }
}

section('SEC-09 · secure-wager: live endpoint returns generic error (no DB details)');
{
  // Hit the edge function with a bad session token and verify the error response
  // doesn't contain any DB column names, Supabase codes, or stack traces
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/secure-wager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'X-Session-Token': 'bad-token-intentionally',
      },
      body: JSON.stringify({ action: 'create', game: 'chess', stake_lamports: 1000000 }),
    });
    const json = await res.json().catch(() => ({}));
    const body = JSON.stringify(json);

    // Should return 401 (bad token) — not 500 with DB details
    if (res.status === 401) {
      ok('Returns 401 for bad session token (not 500 with DB details)');
    } else if (res.status === 503) {
      ok('Returns 503 (env var not configured) — acceptable');
    } else {
      fail(`Unexpected status ${res.status}`, body);
    }

    // Check that common DB error patterns don't appear in the response
    const dbLeakPatterns = ['syntax error', 'column', 'relation', 'violates', 'pg_', 'ERROR:'];
    const leaks = dbLeakPatterns.filter(p => body.toLowerCase().includes(p.toLowerCase()));
    if (leaks.length === 0) {
      ok('Response contains no DB error details');
    } else {
      fail(`Response leaks DB details: ${leaks.join(', ')}`, body.slice(0, 200));
    }
  } catch (e) {
    fail('Could not reach secure-wager function', e.message);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉  All Phase 1 checks passed!');
} else {
  console.log('⚠️   Some checks failed — review output above before deploying.');
}
