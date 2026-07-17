/** Escape a value for CSV (RFC 4180-style). */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsvRow(
  cells: (string | number | null | undefined)[]
): string {
  return cells.map(csvCell).join(",");
}

export function parseDateParam(value: string, endOfDay: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (endOfDay) return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/** YYYY-MM-DD in UTC for `<input type="date">` defaults. */
export function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfMonth(d = new Date()): string {
  return formatDateInput(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  );
}

export function todayUtc(): string {
  return formatDateInput(new Date());
}
