const RESOLVE_WAGER_CALLER_SECRET = "5e5770fed641e0e583a0c18a697f008285352e691e52a820b8200c03446dfa66";
const SUPABASE_URL = "https://vqgtwalwvalbephvpxap.supabase.co";

const wagersToCheck = [
  { id: "66e1a401-f1bb-459c-8c7b-9728579177e9", match_id: 1773779606538, player_a: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", player_b: "2gEhj7XYpgssHvJW7XrehbK72x7etQk1w5QqwmU3BpQH", stake: 500000000 },
  { id: "9d2e0ff4-b4ec-4da5-9bfd-fb668e132665", match_id: 1773503908361, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", stake: 500000000 },
  { id: "f47e37af-8fdb-49f5-b33b-c49386c5510a", match_id: 1773532030609, player_a: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", stake: 100000000 },
  { id: "d062a039-e69e-475d-a3b6-2c67db76a29a", match_id: 1773526939665, player_a: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", stake: 500000000 },
  { id: "6178c5a5-0b03-49e5-8daa-e3f4de37690c", match_id: 4, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", stake: 2000000000 },
  { id: "64592479-58ee-4c22-86c1-6e6ac0a7a998", match_id: 1, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", stake: 1000000000 },
  { id: "bac2f956-bfc2-4a82-be9b-7abde824d503", match_id: 1774004484024, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", stake: 2000000000 },
  { id: "ee4b0e27-794d-4e7d-aaf5-bbbebbbfe1f3", match_id: 5, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", stake: 100000000 },
  { id: "3b1db704-5f2b-4093-93dc-23664d1bb361", match_id: 2, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", stake: 1000000000 },
  { id: "4994e790-4b48-4629-a92e-1b29387f1a6f", match_id: 37, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", stake: 1000000000 },
  { id: "0da4c513-6d6c-4f6a-acbe-54e6fe9653ee", match_id: 41, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", stake: 1000000000 },
  { id: "1e6c4fdd-96c8-4dea-bc22-b2a3125afe71", match_id: 49, player_a: "FaasAGb4kEBzgEUz5KkQUFJ6NaQPhhubdB4scsEzNMou", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", stake: 100000000 },
];

async function callRefundCancelled(wager) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-wager`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-caller-secret": RESOLVE_WAGER_CALLER_SECRET },
    body: JSON.stringify({
      action: "refund_cancelled",
      wagerId: wager.id,
      matchId: wager.match_id,
      playerAWallet: wager.player_a,
      playerBWallet: wager.player_b,
      stakeLamports: wager.stake,
      cancelledBy: wager.player_a,
      reason: "admin_manual_recovery",
    }),
  });
  return await res.json();
}

function isAlreadyDone(result) {
  const s = JSON.stringify(result).toLowerCase();
  return s.includes("accountdidnotdeserialize") || s.includes("simulation failed") || s.includes("pda balance: 0") || s.includes("no on-chain funds");
}

console.log("GameGambit — Cancelled Wager Recovery\n");

let fixed = 0, clean = 0;
const stuck = [];

for (const wager of wagersToCheck) {
  const sol = (wager.stake / 1e9).toFixed(3);
  process.stdout.write(`[${wager.id.slice(0,8)}] ${sol} SOL — `);

  const result = await callRefundCancelled(wager);

  if (result.success === true) {
    const tx = result.txSignature || "no-tx";
    const msg = tx === null ? "PDA had 0 balance (already refunded)" : `REFUNDED — ${tx.slice(0,30)}...`;
    console.log(msg);
    tx === null ? clean++ : fixed++;
  } else if (isAlreadyDone(result)) {
    console.log(`Clean (already refunded)`);
    clean++;
  } else {
    const msg = (result.error || JSON.stringify(result)).slice(0, 100);
    console.log(`STUCK — ${msg}`);
    stuck.push({ id: wager.id, sol, error: msg });
  }

  await new Promise(r => setTimeout(r, 600));
}

console.log(`\nResults: Refunded=${fixed} Already clean=${clean} Stuck=${stuck.length}`);
if (stuck.length) {
  console.log("\nStuck:");
  stuck.forEach(s => console.log(`  ${s.id} (${s.sol} SOL): ${s.error}`));
}
