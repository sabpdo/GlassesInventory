/** Capitalize each word segment (handles spaces, hyphens, slashes). */
export function toDisplayCase(value: string): string {
  return value.trim().replace(/\b\w+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

/** Return the known canonical spelling when input matches case-insensitively. */
export function pickKnownCanonical(
  input: string,
  known: readonly string[]
): string | null {
  const lower = input.trim().toLowerCase();
  if (!lower) return null;
  for (const k of known) {
    if (k.toLowerCase() === lower) return k;
  }
  return null;
}

export function normalizeLabel(
  input: string,
  known: readonly string[]
): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  return pickKnownCanonical(trimmed, known) ?? toDisplayCase(trimmed);
}
