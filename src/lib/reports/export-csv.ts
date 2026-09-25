import type { ReportData } from './types';

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

function buildCycleCsv(report: ReportData): string {
  const rows: string[] = [];
  rows.push(toCsvRow(['Start Date', 'End Date', 'Cycle Length (days)', 'Period Length (days)', 'Flow']));
  for (const c of report.cycle.cycles) {
    rows.push(toCsvRow([
      c.startDate,
      c.endDate ?? '',
      c.cycleLength ?? '',
      c.periodLength ?? '',
      c.flow ?? '',
    ]));
  }
  return rows.join('\n');
}

function buildSummaryCsv(report: ReportData): string {
  const rows: string[] = [];
  rows.push(toCsvRow(['Section', 'Metric', 'Value', 'Sufficiency']));

  const val = (v: { value: number | null; sufficiency: string }) =>
    v.value !== null ? String(v.value) : '';

  const cycle = report.cycle;
  rows.push(toCsvRow(['Cycle', 'Recorded Cycles', String(cycle.recordedCycles), '']));
  rows.push(toCsvRow(['Cycle', 'Average Length', val(cycle.averageCycleLength), cycle.averageCycleLength.sufficiency]));
  rows.push(toCsvRow(['Cycle', 'Shortest', val(cycle.shortestCycle), cycle.shortestCycle.sufficiency]));
  rows.push(toCsvRow(['Cycle', 'Longest', val(cycle.longestCycle), cycle.longestCycle.sufficiency]));
  rows.push(toCsvRow(['Cycle', 'Most Recent', val(cycle.mostRecentCycleLength), cycle.mostRecentCycleLength.sufficiency]));
  rows.push(toCsvRow(['Cycle', 'Variability', cycle.variability.category, '']));
  rows.push(toCsvRow(['Cycle', 'Prediction Available', String(cycle.predictionAvailable), '']));

  const period = report.period;
  rows.push(toCsvRow(['Period', 'Recorded Periods', String(period.recordedPeriods), '']));
  rows.push(toCsvRow(['Period', 'Average Duration', val(period.averageDuration), period.averageDuration.sufficiency]));
  rows.push(toCsvRow(['Period', 'Shortest', val(period.shortestDuration), period.shortestDuration.sufficiency]));
  rows.push(toCsvRow(['Period', 'Longest', val(period.longestDuration), period.longestDuration.sufficiency]));
  rows.push(toCsvRow(['Period', 'Ongoing', String(period.ongoingPeriod), '']));
  for (const f of period.flowDistribution) {
    rows.push(toCsvRow(['Period', `Flow: ${f.level}`, String(f.count), '']));
  }

  const symptoms = report.symptoms;
  rows.push(toCsvRow(['Symptoms', 'Recorded Days', String(symptoms.recordedDays), '']));
  for (const s of symptoms.mostFrequent) {
    rows.push(toCsvRow(['Symptoms', s.id, String(s.count), '']));
  }

  const mood = report.mood;
  rows.push(toCsvRow(['Mood', 'Recorded Days', String(mood.recordedDays), '']));
  for (const m of mood.mostFrequent) {
    rows.push(toCsvRow(['Mood', m.id, String(m.count), '']));
  }

  const pain = report.pain;
  rows.push(toCsvRow(['Pain', 'Recorded Days', String(pain.recordedDays), '']));
  rows.push(toCsvRow(['Pain', 'Average', val(pain.average), pain.average.sufficiency]));
  rows.push(toCsvRow(['Pain', 'Highest', val(pain.highest), pain.highest.sufficiency]));
  rows.push(toCsvRow(['Pain', 'Lowest', val(pain.lowest), pain.lowest.sufficiency]));

  const sleep = report.sleep;
  rows.push(toCsvRow(['Sleep', 'Recorded Days', String(sleep.recordedDays), '']));
  rows.push(toCsvRow(['Sleep', 'Average', val(sleep.average), sleep.average.sufficiency]));
  rows.push(toCsvRow(['Sleep', 'Minimum', val(sleep.minimum), sleep.minimum.sufficiency]));
  rows.push(toCsvRow(['Sleep', 'Maximum', val(sleep.maximum), sleep.maximum.sufficiency]));

  const hydration = report.hydration;
  rows.push(toCsvRow(['Hydration', 'Recorded Days', String(hydration.recordedDays), '']));
  rows.push(toCsvRow(['Hydration', 'Average', val(hydration.average), hydration.average.sufficiency]));
  rows.push(toCsvRow(['Hydration', 'Minimum', val(hydration.minimum), hydration.minimum.sufficiency]));
  rows.push(toCsvRow(['Hydration', 'Maximum', val(hydration.maximum), hydration.maximum.sufficiency]));

  return rows.join('\n');
}

/**
 * Generates a CSV string for the report summary.
 */
export function exportReportAsCsv(report: ReportData): string {
  const parts: string[] = [];
  parts.push('# PMSify Health Report');
  parts.push(`# Date Range: ${report.dateRange.startDate} to ${report.dateRange.endDate}`);
  parts.push(`# Generated: ${report.generatedAt}`);
  parts.push('');
  parts.push(buildSummaryCsv(report));
  parts.push('');
  parts.push('# Cycle Records');
  parts.push(buildCycleCsv(report));
  return parts.join('\n');
}

/**
 * Triggers a browser download of the CSV report file.
 */
export function downloadCsv(report: ReportData): void {
  const csv = exportReportAsCsv(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pmsify-report-${report.dateRange.startDate}-to-${report.dateRange.endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
