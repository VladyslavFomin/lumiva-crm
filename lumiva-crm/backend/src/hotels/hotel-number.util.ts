/** Normalizes a user-entered or imported numeric-ish string to a plain dot-decimal string safe
 * for Postgres numeric columns. Applied at every write path that accepts a money/percentage/
 * coefficient value — not just imports — since manual edits in the grid are just as often typed
 * or pasted straight out of an Excel file that uses a comma decimal separator (e.g. "35,5").
 * Handles: EU thousand-separator + decimal-comma ("1.234,56"), plain decimal comma ("35,5"),
 * stray currency/percent symbols, and blank/undefined input (→ '0'). */
export function normalizeNumericInput(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '0';
  let s = String(raw).trim().replace(/[€$£%\s]/g, '');
  if (!s) return '0';
  if (s.includes('.') && s.includes(',')) {
    // Dot = thousands separator, comma = decimal separator (e.g. "1.234,56")
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return s || '0';
}
