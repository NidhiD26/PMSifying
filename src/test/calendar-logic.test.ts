import { describe, it, expect } from 'vitest';
import type { CycleDomainModel } from '@/types/health';

// Helper function to mirror calendar grid date calculation logic
function generateMonthDays(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const days: { day: number; dateIso: string }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const padMonth = String(month + 1).padStart(2, '0');
    const padDay = String(d).padStart(2, '0');
    days.push({ day: d, dateIso: `${year}-${padMonth}-${padDay}` });
  }

  return { daysInMonth, firstDayOfWeek, days };
}

describe('Calendar Logic & Date Grid Computations', () => {
  it('correctly calculates days in February for leap vs non-leap years', () => {
    // Non-leap year (2025)
    const feb2025 = generateMonthDays(2025, 1);
    expect(feb2025.daysInMonth).toBe(28);

    // Leap year (2024)
    const feb2024 = generateMonthDays(2024, 1);
    expect(feb2024.daysInMonth).toBe(29);

    // Leap year (2028)
    const feb2028 = generateMonthDays(2028, 1);
    expect(feb2028.daysInMonth).toBe(29);
  });

  it('correctly calculates days for 30-day and 31-day months', () => {
    // April (30 days)
    const april = generateMonthDays(2026, 3);
    expect(april.daysInMonth).toBe(30);

    // August (31 days)
    const august = generateMonthDays(2026, 7);
    expect(august.daysInMonth).toBe(31);
  });

  it('handles year boundary transitions (Dec -> Jan, Jan -> Dec)', () => {
    const dec = new Date(2026, 11, 1);
    const nextJan = new Date(dec.getFullYear(), dec.getMonth() + 1, 1);
    expect(nextJan.getFullYear()).toBe(2027);
    expect(nextJan.getMonth()).toBe(0);

    const prevDec = new Date(nextJan.getFullYear(), nextJan.getMonth() - 1, 1);
    expect(prevDec.getFullYear()).toBe(2026);
    expect(prevDec.getMonth()).toBe(11);
  });

  it('maps multi-day period range across calendar dates correctly without timezone shifts', () => {
    const cycle: CycleDomainModel = {
      startDate: '2026-08-28',
      endDate: '2026-09-02',
      createdAt: '',
      updatedAt: '',
    };

    const isPeriodDay = (dateIso: string) => {
      if (cycle.endDate) {
        return dateIso >= cycle.startDate && dateIso <= cycle.endDate;
      }
      return dateIso === cycle.startDate;
    };

    expect(isPeriodDay('2026-08-27')).toBe(false);
    expect(isPeriodDay('2026-08-28')).toBe(true); // Start
    expect(isPeriodDay('2026-08-31')).toBe(true); // Aug end
    expect(isPeriodDay('2026-09-01')).toBe(true); // Sep start
    expect(isPeriodDay('2026-09-02')).toBe(true); // End
    expect(isPeriodDay('2026-09-03')).toBe(false);
  });
});
