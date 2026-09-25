import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportData } from './types';

function sufficiencyLabel(v: { sufficiency: string; value: number | null }): string {
  if (v.sufficiency === 'no_data') return '—';
  if (v.sufficiency === 'insufficient') return 'Insufficient data';
  return v.value !== null ? String(v.value) : '—';
}

/**
 * Generates a PDF report from the composed ReportData.
 * Uses jsPDF + jspdf-autotable. Local-only — no network calls.
 */
export function generateReportPdf(report: ReportData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  function addTitle(text: string, fontSize = 18) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.text(text, margin, y);
    y += fontSize * 0.5;
  }

  function addHeading(text: string) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(text, margin, y);
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  function addBody(text: string) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 4;
    }
  }

  function addKVTable(rows: [string, string][]) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Metric', 'Value']],
      body: rows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [45, 27, 45], textColor: [253, 251, 247] },
      alternateRowStyles: { fillColor: [249, 235, 234] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  function checkPageBreak(needed = 20) {
    if (y > 297 - needed) { doc.addPage(); y = margin; }
  }

  // Title
  addTitle('PMSify Health Report');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Report Period: ${report.dateRange.startDate} to ${report.dateRange.endDate}`, margin, y + 2);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 102);
  doc.text(`Generated: ${report.generatedAt}`, margin, y);
  doc.setTextColor(30, 30, 36);
  y += 10;

  // Cycle
  checkPageBreak(40);
  addHeading('Cycle Summary');
  if (report.cycle.recordedCycles === 0) {
    addBody('No cycle data recorded for this period.');
  } else {
    addKVTable([
      ['Recorded Cycles', String(report.cycle.recordedCycles)],
      ['Average Length', sufficiencyLabel(report.cycle.averageCycleLength)],
      ['Shortest Cycle', sufficiencyLabel(report.cycle.shortestCycle)],
      ['Longest Cycle', sufficiencyLabel(report.cycle.longestCycle)],
      ['Most Recent', sufficiencyLabel(report.cycle.mostRecentCycleLength)],
      ['Variability', report.cycle.variability.category],
      ['Prediction Available', report.cycle.predictionAvailable ? 'Yes' : 'No'],
    ]);
  }

  // Period
  checkPageBreak(40);
  addHeading('Period Summary');
  if (report.period.recordedPeriods === 0) {
    addBody('No period data recorded for this period.');
  } else {
    const rows: [string, string][] = [
      ['Recorded Periods', String(report.period.recordedPeriods)],
      ['Average Duration', sufficiencyLabel(report.period.averageDuration)],
      ['Shortest', sufficiencyLabel(report.period.shortestDuration)],
      ['Longest', sufficiencyLabel(report.period.longestDuration)],
      ['Ongoing', report.period.ongoingPeriod ? 'Yes' : 'No'],
    ];
    for (const f of report.period.flowDistribution) {
      rows.push([`Flow: ${f.level}`, String(f.count)]);
    }
    addKVTable(rows);
  }

  // Symptoms
  checkPageBreak(30);
  addHeading('Symptoms');
  if (report.symptoms.recordedDays === 0) {
    addBody('No symptom data recorded for this period.');
  } else {
    addBody(`Recorded on ${report.symptoms.recordedDays} day(s).`);
    if (report.symptoms.mostFrequent.length > 0) {
      const rows: [string, string][] = report.symptoms.mostFrequent.map((s) => [s.id, `${s.count} day(s)`]);
      addKVTable(rows);
    }
  }

  // Mood
  checkPageBreak(30);
  addHeading('Mood');
  if (report.mood.recordedDays === 0) {
    addBody('No mood data recorded for this period.');
  } else {
    addBody(`Recorded on ${report.mood.recordedDays} day(s).`);
    if (report.mood.mostFrequent.length > 0) {
      const rows: [string, string][] = report.mood.mostFrequent.map((m) => [m.id, `${m.count} day(s)`]);
      addKVTable(rows);
    }
  }

  // Pain
  checkPageBreak(30);
  addHeading('Pain');
  if (report.pain.recordedDays === 0) {
    addBody('No pain data recorded for this period.');
  } else {
    addKVTable([
      ['Recorded Days', String(report.pain.recordedDays)],
      ['Average', sufficiencyLabel(report.pain.average)],
      ['Highest', sufficiencyLabel(report.pain.highest)],
      ['Lowest', sufficiencyLabel(report.pain.lowest)],
    ]);
  }

  // Sleep
  checkPageBreak(30);
  addHeading('Sleep');
  if (report.sleep.recordedDays === 0) {
    addBody('No sleep data recorded for this period.');
  } else {
    addKVTable([
      ['Recorded Days', String(report.sleep.recordedDays)],
      ['Average (hours)', sufficiencyLabel(report.sleep.average)],
      ['Minimum', sufficiencyLabel(report.sleep.minimum)],
      ['Maximum', sufficiencyLabel(report.sleep.maximum)],
    ]);
  }

  // Hydration
  checkPageBreak(30);
  addHeading('Hydration');
  if (report.hydration.recordedDays === 0) {
    addBody('No hydration data recorded for this period.');
  } else {
    addKVTable([
      ['Recorded Days', String(report.hydration.recordedDays)],
      ['Average (ml)', sufficiencyLabel(report.hydration.average)],
      ['Minimum', sufficiencyLabel(report.hydration.minimum)],
      ['Maximum', sufficiencyLabel(report.hydration.maximum)],
    ]);
  }

  // Insights
  checkPageBreak(30);
  addHeading('Personalized Insights');
  if (report.insights.length === 0) {
    addBody('No personalized insights available for this data.');
  } else {
    for (const insight of report.insights) {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`[${insight.category}] ${insight.id}`, margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Priority: ${insight.priority} | Key: ${insight.messageKey}`, margin, y);
      y += 5;
      if (insight.params) {
        const paramStr = Object.entries(insight.params).map(([k, v]) => `${k}=${v}`).join(', ');
        doc.text(`Parameters: ${paramStr}`, margin, y);
        y += 5;
      }
      y += 2;
    }
  }

  // Privacy footer
  checkPageBreak(20);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 102);
  doc.text('This report was generated locally on this device. No data was transmitted.', margin, y);

  return doc;
}

/**
 * Triggers a browser download of the PDF report.
 */
export function downloadPdf(report: ReportData): void {
  const doc = generateReportPdf(report);
  doc.save(`pmsify-report-${report.dateRange.startDate}-to-${report.dateRange.endDate}.pdf`);
}
