import { randomInt } from "crypto";

// Unambiguous alphabet — no 0/O, 1/I, etc.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePairingCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

// Sessions auto-expire — keeps the table tiny and stops stale links from
// working forever. 30 minutes is plenty for a single counter shift.
export const PAIRING_TTL_MS = 30 * 60 * 1000;
