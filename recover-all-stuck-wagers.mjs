/**
 * GameGambit — Full Stuck Wager Recovery
 * Generated from pda-scan-2026-04-19.csv
 *
 * 98 resolved wagers → calls resolve_wager (pays winner)
 *  8 cancelled wagers → calls refund_cancelled (refunds player_a)
 *
 * Run: node recover-all-stuck-wagers.mjs
 *
 * If a PDA already has 0 balance the call returns success with no tx — that's fine.
 * If it returns AccountDidNotDeserialize the account is already closed — also fine.
 * Only actual errors are flagged as STUCK.
 */

const RESOLVE_WAGER_CALLER_SECRET = "5e5770fed641e0e583a0c18a697f008285352e691e52a820b8200c03446dfa66";
const SUPABASE_URL = "https://vqgtwalwvalbephvpxap.supabase.co";
const DELAY_MS = 700; // stay well under rate limits

// ── 98 RESOLVED wagers — pay winner ──────────────────────────────────────────
const resolvedWagers = [
  { id: "f8a361d2-b87f-41d4-9b5e-9bdf9b6404f6", match_id: "1773505324758", stake: 500000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "75cbcf9e-aff1-40a8-95e8-ebaed11f759d", match_id: "1773505596750", stake: 500000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "79065e48-21c9-42b4-b280-a9a7c7b77fcf", match_id: "1773590710835", stake: 500000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "53582c02-1f6f-48bc-b32f-b12af2111921", match_id: "1773612282664", stake: 500000000, player_a: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "4f4bfb1e-3eec-42d4-a1e3-1517caf1f7e0", match_id: "1773777120643", stake: 500000000, player_a: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "ba8632a5-fb99-41d6-ae8c-a61366d9e9cc", match_id: "1773780222401", stake: 500000000, player_a: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", player_b: "2gEhj7XYpgssHvJW7XrehbK72x7etQk1w5QqwmU3BpQH", winner: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g" },
  { id: "be031222-27e3-492c-a501-2ae0284b4f17", match_id: "1773946237415", stake: 100000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGp BXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "a3e2cfdd-fb2c-4ea4-98d6-4bfce5fcd895", match_id: "1773947505663", stake: 500000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "905377a1-5798-472d-a4fa-a8269bc4b76d", match_id: "6",  stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "d1a11853-2557-46d8-8197-c94e2ceaaae0", match_id: "10", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "436b8662-15d5-4dde-b72c-c0c1b0d21d74", match_id: "11", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "6cf496ac-0773-4420-9415-31a654846314", match_id: "12", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "2bb73a65-e18a-4275-a2c6-f4d7f9f6335a", match_id: "14", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "e2bffa28-b304-4ed9-ae2b-ca5a1720b9d2", match_id: "17", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "ee966fdb-c567-4141-8748-a3eb0f39a822", match_id: "20", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "f4685a5a-16d8-4e4f-a748-92f4130627a7", match_id: "23", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "382513e3-917f-4968-a4b3-c43bf536c7a1", match_id: "24", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "2ea1c681-37e0-4e1f-904a-695552f688d6", match_id: "25", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "3bc8831b-24c6-4e19-a8ee-13af2c7ae68d", match_id: "26", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "b148fb39-4846-436b-bac2-394885c33dba", match_id: "27", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "88830c66-91ce-482a-9b23-25f7e0d15faa", match_id: "31", stake: 10000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "61e7750f-d0b3-444d-82a9-07a3a2089d47", match_id: "35", stake: 1000000000, player_a: "HeQujLLNxPCSrHUHqD4gVecp3N89Pjf8BoFToYskidXx", player_b: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", winner: "HeQujLLNxPCSrHUHqD4gVecp3N89Pjf8BoFToYskidXx" },
  { id: "d97bd307-fceb-4573-976f-e94c65b6e81d", match_id: "36", stake: 1000000000, player_a: "FaasAGb4kEBzgEUz5KkQUFJ6NaQPhhubdB4scsEzNMou", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "c91358fc-8b97-451a-af71-4a1a20ebd56c", match_id: "38", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "45d21731-fc38-46ee-ab11-0bf1aa45c56a", match_id: "39", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "d8dc748e-a51d-42cb-a4c8-dc23d8725afd", match_id: "42", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "8686834a-1df5-4bbd-a4e3-f05a4680c904", match_id: "43", stake: 1000000000, player_a: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "843240a6-b638-4123-bdc2-f0f20374eb78", match_id: "44", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "9a1123bc-67b4-48ba-85c6-c3eeb35f4ddb", match_id: "46", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "f3ec459d-d02a-405f-b85d-f6f57fbe80dd", match_id: "47", stake: 1000000000, player_a: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "9cbb1043-a94e-469d-8374-3654f0af5d3c", match_id: "48", stake: 1000000000, player_a: "FaasAGb4kEBzgEUz5KkQUFJ6NaQPhhubdB4scsEzNMou", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "80dfc861-98c6-4fed-b25f-81a2ca88902a", match_id: "50", stake: 2000000000, player_a: "FaasAGb4kEBzgEUz5KkQUFJ6NaQPhhubdB4scsEzNMou", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "18b5d8cc-dc5a-4cdb-8ae4-fe50912fdc3a", match_id: "51", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "FaasAGb4kEBzgEUz5KkQUFJ6NaQPhhubdB4scsEzNMou", winner: "FaasAGb4kEBzgEUz5KkQUFJ6NaQPhhubdB4scsEzNMou" },
  { id: "351101bd-7edd-4d30-ac37-131f1ada1662", match_id: "52", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "FaasAGb4kEBzgEUz5KkQUFJ6NaQPhhubdB4scsEzNMou", winner: "FaasAGb4kEBzgEUz5KkQUFJ6NaQPhhubdB4scsEzNMou" },
  { id: "dcc4e0dd-f1f9-4112-850e-d14ce510407a", match_id: "53", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "1cf4be18-d684-4a35-9d52-49e65eb8096a", match_id: "54", stake: 5000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "7e5abf34-6744-4815-96a0-fd03dcc413d4", match_id: "55", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "11c6ab68-73b9-4bc8-bcc6-91a8db1adf78", match_id: "56", stake: 3000000000, player_a: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "7fd179f0-b5d2-4dd2-a2fe-a1f6e1e91a17", match_id: "59", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "03184a22-9adb-4c9f-b1c5-7268e3a378af", match_id: "61", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "12369a07-68cd-46a3-97cc-0905679776bb", match_id: "62", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "6b1bc364-e5be-4239-aaa3-440a8bc3cd19", match_id: "64", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "b6456620-eb95-4bb3-8f9e-a009eedde5ec", match_id: "67", stake: 3000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "2fbf9653-ae46-4e01-bd4c-20681fca7c37", match_id: "68", stake: 3000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "c512fa4f-bf28-4fa0-a587-7f7c6a235630", match_id: "70", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "7a18ffa4-f746-490e-9a7e-97c36d3d794e", match_id: "75", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "8d09b64b-4fbc-4449-b3ee-48e8342ccb10", match_id: "76", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "67a25449-bc91-411b-8990-cb60caffca59", match_id: "81", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "b763a803-0aa8-42c3-99a6-6b7217bcf07c", match_id: "83", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "6c0f4cd9-1db1-4e9b-b409-ab203ee7e7db", match_id: "85", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "195177d4-8a98-43f3-930b-0c47342004e7", match_id: "86", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "7cab13c3-3873-47a1-8790-99ba179e5eb7", match_id: "87", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "2dbc56f1-02ec-4372-9052-fc7a51be323c", match_id: "89", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "d8841597-69a7-46ce-8c28-8c129fe7606a", match_id: "91", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "35c8dc08-734c-409a-812e-dc0df00b90fb", match_id: "92", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "c7383e40-237b-41ce-a557-9bb3708837d2", match_id: "101", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "a1d47d1c-6e0b-4d75-ab7e-77b2cc6ec3a8", match_id: "102", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "33be51b8-c160-4556-895f-46b77c7a08f0", match_id: "110", stake: 1990000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "ad0bdc5b-c601-417a-a8b5-e55cc6c6215b", match_id: "111", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "c2e1557d-6b16-4ba5-b685-5ab85c5a6a37", match_id: "114", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "24dd4840-b240-492d-b83a-279423e4ca44", match_id: "115", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "bf6e6807-3179-4149-b7f2-158ea208adba", match_id: "116", stake: 2000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "9b115f5a-cde5-4564-b683-61bb23c34134", match_id: "117", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "6add2fb4-533e-44f2-b905-d2d33aa7b35d", match_id: "118", stake: 500000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "2a512d43-4461-4312-a08d-9aef2e09cd13", match_id: "119", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "bc1bcd83-672e-4cdf-b809-49547d46c6f9", match_id: "120", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "55a9f204-5a5e-44a7-8595-f34537c62a78", match_id: "122", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "1e536827-23b7-4d73-879e-ea19a34bc22d", match_id: "123", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "5b0a4e52-db55-45b3-9d0e-8440da2b7481", match_id: "124", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "eeceff60-6ec4-4ad4-93fb-2483c5e47517", match_id: "125", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "541cc9a3-07ef-4f09-add1-5442fc7a5cde", match_id: "126", stake: 250000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "cdad8a9d-5d9e-41ce-a376-e8e870fd1b16", match_id: "127", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "591a8335-259c-4db1-a0db-86262bcf394f", match_id: "128", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "88e0ee59-bc08-49b3-acc9-95a5e541685a", match_id: "129", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "2da93cef-3ea5-41e8-9edc-00bb1f643dc3", match_id: "130", stake: 100000000,  player_a: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "800af703-882b-491e-b075-3da428308651", match_id: "131", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "47f6bfda-3f65-4764-a840-2efec738fa6a", match_id: "132", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "2b639a57-faf3-4f55-80e6-96e7e5cb3448", match_id: "133", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "b0c7018b-0e28-4537-9efc-88b39823ce48", match_id: "134", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "a87a7f36-f1f8-487c-aec2-90baacc8999a", match_id: "135", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "902aae48-6887-4e9a-a68a-2b242955c27b", match_id: "136", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "b62100e8-0c24-42d3-9f88-01cba44d3d37", match_id: "137", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "45ddc60e-909b-4a8c-91a5-b4d82dcd84bc", match_id: "138", stake: 100000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "a014a8c0-a6bc-4733-95a1-bf72b3aa137d", match_id: "139", stake: 250000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "b55a251e-acf3-4a9d-9e84-598eea4494b9", match_id: "141", stake: 1000000000, player_a: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "83795499-76d9-4f04-bfca-c8bc71220bb0", match_id: "144", stake: 500000000,  player_a: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", player_b: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", winner: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g" },
  { id: "d1cb84d0-2413-419e-b2c2-d8aae0d2ecee", match_id: "154", stake: 500000000,  player_a: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", winner: "C4qTp5bqJxmkRigenZFCabVhgoa369jJ3nNDFWLjNd6g" },
  { id: "599e4dba-4993-4c5d-90be-a8f34273d973", match_id: "155", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGp BXk", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "045d35fd-aab4-46f9-839a-8cd2cf90fbe4", match_id: "156", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "45d92efd-5bb0-4d95-a37d-0b1420639a2e", match_id: "157", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "0de24d9b-7f04-4d40-988f-3a04e66de314", match_id: "158", stake: 1000000000, player_a: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", winner: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "58236957-4018-4dca-90a9-3cb7a88b4fc5", match_id: "159", stake: 500000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "f14052e8-7eb9-4550-af2c-f62556558e31", match_id: "160", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "25f4d18a-c6ac-46de-9e00-2210cd800e2c", match_id: "161", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "f7e4dab7-18da-46e3-8aad-b38d70fffe88", match_id: "162", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "0f16cd1d-9dd2-4ff0-8fb3-6235b5250c40", match_id: "163", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "fd29ad55-527b-48aa-9dea-d0bc0749f7c9", match_id: "164", stake: 2000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "4c004115-bbd9-4676-8cb5-6ad3bedac5a8", match_id: "165", stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", winner: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
];

// ── 8 CANCELLED wagers — refund player_a ─────────────────────────────────────
const cancelledWagers = [
  { id: "9d2e0ff4-b4ec-4da5-9bfd-fb668e132665", match_id: "1773503908361", stake: 500000000,  player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "64592479-58ee-4c22-86c1-6e6ac0a7a998", match_id: "1",             stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "3b1db704-5f2b-4093-93dc-23664d1bb361", match_id: "2",             stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "6178c5a5-0b03-49e5-8daa-e3f4de37690c", match_id: "4",             stake: 2000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "1e6c4fdd-96c8-4dea-bc22-b2a3125afe71", match_id: "49",            stake: 100000000,  player_a: "FaasAGb4kEBzgEUz5KkQUFJ6NaQPhhubdB4scsEzNMou", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "65a9d26a-0c93-45bf-aca0-40ae8289acbf", match_id: "78",            stake: 5000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
  { id: "9b6e6847-dd52-42c1-bfa4-5d1301f58b5b", match_id: "84",            stake: 1000000000, player_a: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk", player_b: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g" },
  { id: "66fad1ca-6f37-4752-95b5-fa07be796abb", match_id: "90",            stake: 1000000000, player_a: "4ePNbQexf83B7Mv3RRg99eerbSX9o1J24vXyWWSs3E2g", player_b: "9VTcJgDsPDKjFKrh2LU8byGevuf3wNqRj9wWNQTGpBXk" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function isAlreadyDone(result) {
  const s = JSON.stringify(result).toLowerCase();
  return s.includes("accountdidnotdeserialize") ||
         s.includes("simulation failed") ||
         s.includes("pda balance: 0") ||
         s.includes("no on-chain funds") ||
         s.includes("already resolved") ||
         s.includes("already refunded");
}

async function callResolve(w) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-wager`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-caller-secret": RESOLVE_WAGER_CALLER_SECRET },
    body: JSON.stringify({
      action: "resolve_wager",
      wagerId: w.id,
      matchId: w.match_id,
      playerAWallet: w.player_a,
      playerBWallet: w.player_b,
      winnerWallet: w.winner,
      stakeLamports: w.stake,
    }),
  });
  return res.json();
}

async function callRefund(w) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-wager`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-caller-secret": RESOLVE_WAGER_CALLER_SECRET },
    body: JSON.stringify({
      action: "refund_cancelled",
      wagerId: w.id,
      matchId: w.match_id,
      playerAWallet: w.player_a,
      playerBWallet: w.player_b,
      stakeLamports: w.stake,
      cancelledBy: w.player_a,
      reason: "admin_manual_recovery",
    }),
  });
  return res.json();
}

// ── Runner ────────────────────────────────────────────────────────────────────
console.log(`\nGameGambit — Full Wager Recovery`);
console.log(`Resolved: ${resolvedWagers.length} | Cancelled: ${cancelledWagers.length}`);
console.log(`─`.repeat(60));

let recovered = 0, alreadyClean = 0;
const stuck = [];

async function processWagers(label, wagers, callFn) {
  console.log(`\n[${label}]`);
  for (const w of wagers) {
    const sol = (w.stake / 1e9).toFixed(3);
    process.stdout.write(`  [${w.id.slice(0,8)}] ${sol} SOL → `);
    const result = await callFn(w);

    if (result.success === true) {
      const tx = result.txSignature;
      if (!tx) {
        console.log(`Clean (PDA already empty)`);
        alreadyClean++;
      } else {
        console.log(`✅ ${tx.slice(0, 44)}...`);
        recovered++;
      }
    } else if (isAlreadyDone(result)) {
      console.log(`Clean (already processed)`);
      alreadyClean++;
    } else {
      const msg = (result.error || JSON.stringify(result)).slice(0, 120);
      console.log(`❌ ${msg}`);
      stuck.push({ id: w.id, sol, error: msg });
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
}

await processWagers("RESOLVED → pay winner", resolvedWagers, callResolve);
await processWagers("CANCELLED → refund player_a", cancelledWagers, callRefund);

console.log(`\n${"─".repeat(60)}`);
console.log(`Results: Recovered=${recovered} Already clean=${alreadyClean} Stuck=${stuck.length}`);

if (stuck.length) {
  console.log(`\n⚠️  Still stuck (need manual attention):`);
  stuck.forEach(s => console.log(`  ${s.id} (${s.sol} SOL): ${s.error}`));
} else {
  console.log(`\n🎉 All wagers accounted for!`);
}
