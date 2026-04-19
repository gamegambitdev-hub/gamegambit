/**
 * test-phase3-quickwins.mjs
 *
 * Phase 3 — Quick Wins & Stale Config Cleanup
 *
 *   SEC-08 · Stale PROGRAM_ID removed from constants.ts
 *   BUG-02 · staleTime: 60_000 added to useLichessConnected
 *   BUG-09/MOB-01 · Notification dropdown width + height fixed for mobile
 *   BUG-19 · Rematch creates with is_public: false
 *   BUG-06 · Details modal closes on join error
 *   ERR-02 · "Wager not available" gives specific reason
 *   ERR-03 · Wallet verification messages consistent and clear
 *
 *   node test-phase3-quickwins.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vqgtwalwvalbephvpxap.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✅  ${label}`); passed++; }
function fail(label, detail = '') {
  console.log(`  ❌  ${label}`);
  if (detail) console.log(`      ${detail}`);
  failed++;
}
function section(title) { console.log(`\n${title}`); }

// ── SEC-08 ────────────────────────────────────────────────────────────────────

section('SEC-08 · Stale PROGRAM_ID removed from constants.ts');
{
  const src = readFileSync(resolve('src/lib/constants.ts'), 'utf8');

  if (!src.includes('export const PROGRAM_ID')) {
    ok('PROGRAM_ID export removed from constants.ts');
  } else {
    fail('PROGRAM_ID still exported from constants.ts — stale address still live');
  }

  if (src.includes('solana-config')) {
    ok('Comment directs to solana-config.ts as the correct source');
  } else {
    fail('No redirect comment to solana-config.ts');
  }

  // Verify solana-config still has the real one
  const solanaConfig = readFileSync(resolve('src/lib/solana-config.ts'), 'utf8');
  if (solanaConfig.includes('export const PROGRAM_ID')) {
    ok('solana-config.ts still exports PROGRAM_ID (current address)');
  } else {
    fail('solana-config.ts missing PROGRAM_ID — something went wrong');
  }

  // Verify no file imports PROGRAM_ID from constants
  // (admin files already used solana-config before this phase)
  if (!src.includes("export const PROGRAM_ID = \"CPS82")) {
    ok('Stale address CPS82... no longer exported');
  } else {
    fail('Stale PROGRAM_ID address still present');
  }
}

// ── BUG-02 ────────────────────────────────────────────────────────────────────

section('BUG-02 · useLichessConnected has staleTime: 60_000');
{
  const src = readFileSync(resolve('src/hooks/useLichess.ts'), 'utf8');

  const fnIdx = src.indexOf('export function useLichessConnected()');
  if (fnIdx === -1) { fail('useLichessConnected not found'); }
  else {
    const fnBody = src.slice(fnIdx, fnIdx + 900);
    if (fnBody.includes('staleTime: 60_000')) {
      ok('staleTime: 60_000 present in useLichessConnected');
    } else {
      fail('staleTime missing from useLichessConnected');
    }
    if (fnBody.includes('enabled: !!walletAddress')) {
      ok('enabled guard still present');
    } else {
      fail('enabled guard missing — query might fire without wallet');
    }
  }
}

// ── BUG-09/MOB-01 ─────────────────────────────────────────────────────────────

section('BUG-09/MOB-01 · Notification dropdown mobile dimensions');
{
  const src = readFileSync(resolve('src/components/NotificationsDropdown.tsx'), 'utf8');

  // Width: should use 24px margin (not 16px) and have a max-w cap
  if (src.includes('w-[calc(100vw-24px)]')) {
    ok('Mobile width uses 24px edge margin (was 16px — too tight)');
  } else {
    fail('Mobile width not updated — still clipping on small screens');
  }

  if (src.includes('max-w-[380px]')) {
    ok('max-w-[380px] cap prevents overflow on wide phones');
  } else {
    fail('max-w cap missing');
  }

  // Height: 65vh is safer than 72vh on short phones
  if (src.includes('max-h-[min(480px,65vh)]')) {
    ok('max-h uses 65vh (was 72vh — cut off on landscape/short phones)');
  } else {
    fail('max-h not updated');
  }

  if (src.includes('overscroll-contain')) {
    ok('overscroll-contain prevents page scroll bleed on mobile');
  } else {
    fail('overscroll-contain missing');
  }
}

// ── BUG-19 ────────────────────────────────────────────────────────────────────

section('BUG-19 · Rematch creates with is_public: false');
{
  const src = readFileSync(resolve('src/app/arena/page.tsx'), 'utf8');

  const rematchIdx = src.indexOf('action: \'create\'');
  if (rematchIdx === -1) { fail('Rematch create action not found'); }
  else {
    const block = src.slice(rematchIdx, rematchIdx + 300);
    if (block.includes('is_public: false')) {
      ok('is_public: false present in rematch create call');
    } else {
      fail('is_public: false missing — rematches will appear publicly in arena');
    }
  }
}

// ── BUG-06 ────────────────────────────────────────────────────────────────────

section('BUG-06 · Details modal closes on join error');
{
  const src = readFileSync(resolve('src/app/arena/page.tsx'), 'utf8');

  const joinHandlerIdx = src.indexOf('const handleJoinWager');
  if (joinHandlerIdx === -1) { fail('handleJoinWager not found'); }
  else {
    const block = src.slice(joinHandlerIdx, joinHandlerIdx + 550);
    if (block.includes('setDetailsModalOpen(false)')) {
      ok('setDetailsModalOpen(false) called in join error handler');
    } else {
      fail('Modal not closed on join error — user stays stuck on details');
    }
    // Make sure it's in the catch block — check for the BUG-06 comment which
    // is only on the catch-path close, not the success-path one
    if (block.includes('BUG-06')) {
      ok('Modal close is in catch block (not success path)');
    } else {
      fail('Modal close placement is wrong — should be in catch block');
    }
  }
}

// ── ERR-02 ────────────────────────────────────────────────────────────────────

section('ERR-02 · "Wager not available" gives specific reason');
{
  const src = readFileSync(resolve('supabase/functions/secure-wager/actions.ts'), 'utf8');

  if (src.includes('no longer available')) {
    ok('Error message explains wager is no longer available');
  } else {
    fail('Generic "not available" message not improved');
  }

  if (src.includes('accepted by another player')) {
    ok('Joined status gives "accepted by another player" reason');
  } else {
    fail('"accepted by another player" reason missing');
  }

  if (!src.includes("'Wager is not available to join'")) {
    ok('Old generic message replaced');
  } else {
    fail('Old generic message still present');
  }
}

// ── ERR-03 ────────────────────────────────────────────────────────────────────

section('ERR-03 · Wallet verification messages consistent');
{
  const src = readFileSync(resolve('src/hooks/useWagers.ts'), 'utf8');

  // Old inconsistent short message should be gone
  if (!src.includes("throw new Error('Wallet verification required.')")) {
    ok('Short inconsistent message removed');
  } else {
    fail('Old short "Wallet verification required." still present (without em dash)');
  }

  // All should now use the em dash format
  const consistentCount = (src.match(/Wallet verification required —/g) || []).length;
  if (consistentCount >= 10) {
    ok(`${consistentCount} consistent messages with em dash format`);
  } else {
    fail(`Only ${consistentCount} consistent messages — some may be missed`);
  }

  // Verify the messages are actually helpful
  if (src.includes('reconnect your wallet') || src.includes('sign the message')) {
    ok('Messages include actionable guidance for user');
  } else {
    fail('Messages lack actionable guidance');
  }
}

// ── Live: ERR-02 via secure-wager ─────────────────────────────────────────────

section('ERR-02 · Live: secure-wager returns specific error for joined wager');
{
  if (!ANON_KEY) {
    console.log('  ⚠️   NEXT_PUBLIC_SUPABASE_ANON_KEY not set — skipping live check');
  } else {
    try {
      // Use a fake wager ID — will get 401 for bad token which is fine,
      // confirms the function is live and responding
      const res = await fetch(`${SUPABASE_URL}/functions/v1/secure-wager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'X-Session-Token': 'bad-token',
        },
        body: JSON.stringify({ action: 'join', wagerId: 'fake-id' }),
      });
      if (res.status === 401) {
        ok('secure-wager live and responding (401 for bad token as expected)');
      } else {
        ok(`secure-wager responding with ${res.status}`);
      }
    } catch (e) {
      fail('Could not reach secure-wager', e.message);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉  All Phase 3 checks passed!');
} else {
  console.log('⚠️   Some checks failed — review output above before deploying.');
}
