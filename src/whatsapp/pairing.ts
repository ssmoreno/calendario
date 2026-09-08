import { randomInt } from "node:crypto";

export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

const PAIRING_CODE_RANGE = 10 ** PAIRING_CODE_LENGTH;

export function generatePairingCode(): string {
  return String(randomInt(0, PAIRING_CODE_RANGE)).padStart(
    PAIRING_CODE_LENGTH,
    "0",
  );
}

export function extractPairingCode(text: string): string | null {
  const digits = text.replace(/\D/gu, "");
  return digits.length === PAIRING_CODE_LENGTH ? digits : null;
}

export function pairingCodeExpiry(now = new Date()): Date {
  return new Date(now.getTime() + PAIRING_CODE_TTL_MS);
}
