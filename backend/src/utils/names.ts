/** Normalise a first name so "Jürg", "juerg" and " JÜRG " all match. */
export function nameKey(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('de-CH')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Clean a display name. Returns null when invalid. */
export function cleanFirstName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = input.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (v.length < 1 || v.length > 40) return null;
  // Letters (any script), spaces, apostrophes and hyphens only
  if (!/^[\p{L}][\p{L}\p{M}' -]*$/u.test(v)) return null;
  return v;
}
