import { randomInt } from "node:crypto";

export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

const PAIRING_CODE_RANGE = 10 ** PAIRING_CODE_LENGTH;

/** A fresh code, drawn uniformly so a live one cannot be guessed from another. */
export function generatePairingCode(): string {
  return String(randomInt(0, PAIRING_CODE_RANGE)).padStart(
    PAIRING_CODE_LENGTH,
    "0",
  );
}

/**
 * The code an unlinked sender is offering, if any. People text "123456",
 * "123 456", and "my code is 123-456", so the separators are ignored; anything
 * that is not exactly six digits once they are gone is an ordinary message.
 */
export function extractPairingCode(text: string): string | null {
  const digits = text.replace(/\D/gu, "");
  return digits.length === PAIRING_CODE_LENGTH ? digits : null;
}

export function pairingCodeExpiry(now = new Date()): Date {
  return new Date(now.getTime() + PAIRING_CODE_TTL_MS);
}
