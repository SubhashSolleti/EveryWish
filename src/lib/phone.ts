/**
 * Normalise a phone number typed by a user to E.164 ("+14155550123").
 * Requires a country code — we can't guess where the recipient lives.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  const hasCountryCode = trimmed.startsWith("+") || trimmed.startsWith("00");
  if (!hasCountryCode) return null;
  const national = trimmed.startsWith("00") ? digits.slice(2) : digits;
  if (national.length < 8 || national.length > 15 || national.startsWith("0")) return null;
  return `+${national}`;
}

/** WhatsApp user JID for an E.164 number. */
export function phoneToJid(e164: string): string {
  return `${e164.replace(/^\+/, "")}@s.whatsapp.net`;
}
