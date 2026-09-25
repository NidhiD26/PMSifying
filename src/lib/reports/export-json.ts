import type { ReportData } from './types';

/**
 * Serializes the full report data as a deterministic, human-readable JSON string.
 * Local-only — no network calls.
 */
export function exportReportAsJson(report: ReportData): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Triggers a browser download of the JSON report file.
 */
export function downloadJson(report: ReportData): void {
  const json = exportReportAsJson(report);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pmsify-report-${report.dateRange.startDate}-to-${report.dateRange.endDate}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
