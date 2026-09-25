/**
 * Timezone-safe local ISO date string formatter (YYYY-MM-DD).
 * Avoids `.toISOString().split('T')[0]` which shifts local midnight to UTC day before in positive UTC timezones.
 */
export function formatLocalDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
