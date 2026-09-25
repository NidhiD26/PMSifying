import { describe, it, expect } from 'vitest';
import { computeHealthAnalytics, type HealthAnalytics } from '@/lib/analytics';
import { getInsights } from '@/lib/insights';
import type { PersonalInsight } from '@/lib/insights';
import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';

const TODAY = '2026-09-30';

function cycle(
  startDate: string,
  endDate?: string,
  flow?: CycleDomainModel['flow']
): CycleDomainModel {
  return {
    startDate,
    ...(endDate ? { endDate } : {}),
    ...(flow ? { flow } : {}),
    createdAt: '',
    updatedAt: '',
  };
}

function log(
  date: string,
  data: {
    symptoms?: string[];
    mood?: string[];
    painLevel?: number;
    sleepHours?: number;
    hydrationMl?: number;
  } = {}
): DailyLogDomainModel {
  return {
    date,
    symptoms: (data.symptoms ?? []).map((id) => ({ id })),
    mood: (data.mood ?? []).map((id) => ({ id })),
    painLevel: data.painLevel ?? 0,
    sleepHours: data.sleepHours ?? 0,
    hydrationMl: data.hydrationMl ?? 0,
    createdAt: '',
    updatedAt: '',
  };
}

function analyticsFor(
  cycles: CycleDomainModel[],
  dailyLogs: DailyLogDomainModel[],
  range?: { startDate: string; endDate: string }
): HealthAnalytics {
  return computeHealthAnalytics({
    cycles,
    dailyLogs,
    today: TODAY,
    ...(range ? { range } : {}),
  });
}

function ids(insights: PersonalInsight[]): string[] {
  return insights.map((i) => i.id);
}

describe('cycle rules', () => {
  it('no cycles -> no cycle insights', () => {
    const a = analyticsFor([], []);
    const r = getInsights({ analytics: a, recordedDates: [] });
    expect(r.some((i) => i.category === 'cycle')).toBe(false);
  });

  it('one cycle (insufficient) -> no cycle insights', () => {
    const a = analyticsFor([cycle('2026-06-01', '2026-06-05')], []);
    const r = getInsights({ analytics: a, recordedDates: [] });
    expect(r.some((i) => i.category === 'cycle')).toBe(false);
  });

  it('sufficient cycles -> range + recent insights with min/max', () => {
    // intervals: 28, 30, 32
    const a = analyticsFor(
      [
        cycle('2026-06-01', '2026-06-05'),
        cycle('2026-06-29', '2026-07-03'),
        cycle('2026-07-29', '2026-08-02'),
        cycle('2026-08-30', '2026-09-03'),
      ],
      []
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const range = r.find((i) => i.id === 'cycle.range');
    expect(range).toBeDefined();
    expect(range!.params!.min).toBe(28);
    expect(range!.params!.max).toBe(32);
    expect(range!.evidence!.some((e) => e.metric === 'cycleLengthMin')).toBe(true);

    const recent = r.find((i) => i.id === 'cycle.recentVsAverage');
    expect(recent).toBeDefined();
    expect(recent!.params!.recent).toBe(32);
    expect(recent!.params!.average).toBe(30);
  });

  it('variability insight is descriptive, not a diagnosis', () => {
    const a = analyticsFor(
      [
        cycle('2026-06-01', '2026-06-05'),
        cycle('2026-07-01', '2026-07-05'),
        cycle('2026-08-01', '2026-08-05'),
        cycle('2026-09-01', '2026-09-05'),
      ],
      []
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const v = r.find((i) => i.id.startsWith('cycle.variability.'));
    expect(v).toBeDefined();
    // safety: the emitted key must not contain medical terminology
    expect(v!.messageKey).not.toMatch(/irregular|disorder|disease|condition/);
  });

  it('does not reveal recent and recent-vs-average together (dedupe)', () => {
    const a = analyticsFor(
      [
        cycle('2026-06-01', '2026-06-05'),
        cycle('2026-06-29', '2026-07-03'),
        cycle('2026-07-29', '2026-08-02'),
      ],
      []
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const all = ids(r);
    expect(all.filter((id) => id === 'cycle.recent' || id === 'cycle.recentVsAverage').length).toBe(1);
  });
});

describe('period rules', () => {
  it('no periods -> no period insights', () => {
    const a = analyticsFor([], []);
    const r = getInsights({ analytics: a, recordedDates: [] });
    expect(r.some((i) => i.category === 'period')).toBe(false);
  });

  it('sufficient completed periods -> average + duration range', () => {
    const a = analyticsFor(
      [
        cycle('2026-06-01', '2026-06-05'),
        cycle('2026-07-02', '2026-07-07'),
        cycle('2026-08-03', '2026-08-09'),
      ],
      []
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const avg = r.find((i) => i.id === 'period.average');
    expect(avg).toBeDefined();
    expect(avg!.params!.avg).toBe(6);
    const dr = r.find((i) => i.id === 'period.durationRange');
    expect(dr).toBeDefined();
    expect(dr!.params!.min).toBe(5);
    expect(dr!.params!.max).toBe(7);
  });

  it('most frequent flow reported', () => {
    const a = analyticsFor(
      [
        cycle('2026-06-01', '2026-06-05', 'medium'),
        cycle('2026-07-01', '2026-07-05', 'medium'),
        cycle('2026-08-01', '2026-08-05', 'light'),
      ],
      []
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const flow = r.find((i) => i.id === 'period.flow.medium');
    expect(flow).toBeDefined();
    expect(flow!.params!.count).toBe(2);
  });
});

describe('symptom rules', () => {
  it('no symptoms -> no symptom insight', () => {
    const a = analyticsFor([], [log('2026-09-01')]);
    const r = getInsights({ analytics: a, recordedDates: ['2026-09-01'] });
    expect(r.some((i) => i.category === 'symptoms')).toBe(false);
  });

  it('most frequent symptom reported with count', () => {
    const a = analyticsFor(
      [],
      [
        log('2026-09-01', { symptoms: ['cramps', 'headache'] }),
        log('2026-09-02', { symptoms: ['cramps'] }),
        log('2026-09-03', { symptoms: ['cramps', 'fatigue'] }),
      ]
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const top = r.find((i) => i.id === 'symptoms.mostFrequent.cramps');
    expect(top).toBeDefined();
    expect(top!.params!.count).toBe(3);
    expect(top!.evidence!.some((e) => e.metric === 'recordSymptom')).toBe(true);
  });

  it('runner-up symptom yields a count observation', () => {
    const a = analyticsFor(
      [],
      [
        log('2026-09-01', { symptoms: ['cramps'] }),
        log('2026-09-02', { symptoms: ['cramps', 'headache'] }),
        log('2026-09-03', { symptoms: ['cramps', 'headache'] }),
      ]
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const runner = r.find((i) => i.id === 'symptoms.count.headache');
    expect(runner).toBeDefined();
    expect(runner!.params!.count).toBe(2);
  });

  it('tie for most frequent resolves deterministically', () => {
    const a = analyticsFor(
      [],
      [
        log('2026-09-01', { symptoms: ['headache'] }),
        log('2026-09-02', { symptoms: ['cramps'] }),
      ]
    );
    const r1 = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const r2 = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const top1 = r1.find((i) => i.id.startsWith('symptoms.mostFrequent.'));
    const top2 = r2.find((i) => i.id.startsWith('symptoms.mostFrequent.'));
    expect(top1!.id).toBe(top2!.id);
    expect(top1!.id).toBe('symptoms.mostFrequent.cramps'); // lexicographic
  });
});

describe('mood rules', () => {
  it('no mood -> no mood insight', () => {
    const a = analyticsFor([], [log('2026-09-01')]);
    const r = getInsights({ analytics: a, recordedDates: ['2026-09-01'] });
    expect(r.some((i) => i.category === 'mood')).toBe(false);
  });

  it('most frequent mood reported', () => {
    const a = analyticsFor(
      [],
      [
        log('2026-09-01', { mood: ['calm'] }),
        log('2026-09-02', { mood: ['calm'] }),
        log('2026-09-03', { mood: ['happy'] }),
      ]
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const top = r.find((i) => i.id === 'mood.mostFrequent.calm');
    expect(top).toBeDefined();
    expect(top!.params!.count).toBe(2);
  });

  it('mood tie resolves deterministically', () => {
    const a = analyticsFor(
      [],
      [
        log('2026-09-01', { mood: ['happy'] }),
        log('2026-09-02', { mood: ['calm'] }),
      ]
    );
    const r1 = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const r2 = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const top1 = r1.find((i) => i.id.startsWith('mood.mostFrequent.'));
    const top2 = r2.find((i) => i.id.startsWith('mood.mostFrequent.'));
    expect(top1!.id).toBe(top2!.id);
    expect(top1!.id).toBe('mood.mostFrequent.calm');
  });
});

describe('pain, sleep, hydration rules', () => {
  it('pain average reported when available', () => {
    const a = analyticsFor(
      [],
      [
        log('2026-09-01', { painLevel: 2 }),
        log('2026-09-02', { painLevel: 6 }),
        log('2026-09-03', { painLevel: 4 }),
      ]
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const p = r.find((i) => i.id === 'pain.average');
    expect(p).toBeDefined();
    expect(p!.params!.value).toBe(4);
  });

  it('no pain logs -> no pain insight', () => {
    const a = analyticsFor([], []);
    const r = getInsights({ analytics: a, recordedDates: [] });
    expect(r.some((i) => i.category === 'pain')).toBe(false);
  });

  it('sleep average reported', () => {
    const a = analyticsFor(
      [],
      [log('2026-09-01', { sleepHours: 7 }), log('2026-09-02', { sleepHours: 8 })]
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const s = r.find((i) => i.id === 'sleep.average');
    expect(s).toBeDefined();
    expect(s!.params!.value).toBe(7.5);
  });

  it('hydration average and recorded-days reported', () => {
    const a = analyticsFor(
      [],
      [
        log('2026-09-01', { hydrationMl: 2000 }),
        log('2026-09-02', { hydrationMl: 1500 }),
      ]
    );
    const r = getInsights({ analytics: a, recordedDates: [], limit: 20 });
    const avg = r.find((i) => i.id === 'hydration.average');
    expect(avg!.params!.value).toBe(1750);
    const days = r.find((i) => i.id === 'hydration.recordedDays');
    expect(days!.params!.days).toBe(2);
  });
});

describe('completeness', () => {
  it('no records -> no completeness insight', () => {
    const a = analyticsFor([], []);
    const r = getInsights({ analytics: a, recordedDates: [] });
    expect(r.some((i) => i.id === 'general.completeness')).toBe(false);
  });

  it('partial records -> completeness report with count', () => {
    const a = analyticsFor([], [log('2026-09-01'), log('2026-09-02')]);
    const r = getInsights({ analytics: a, recordedDates: ['2026-09-01', '2026-09-02'], limit: 20 });
    const c = r.find((i) => i.id === 'general.completeness');
    expect(c).toBeDefined();
    expect(c!.priority).toBe('low');
    expect(c!.params!.count).toBe(2);
    expect(c!.evidence!.some((e) => e.range)).toBe(true);
  });

  it('counts distinct dates within the range only', () => {
    const a = analyticsFor([], [log('2026-01-15')], { startDate: '2026-09-01', endDate: '2026-09-30' });
    const r = getInsights({ analytics: a, recordedDates: ['2026-01-15'], limit: 20 });
    expect(r.some((i) => i.id === 'general.completeness')).toBe(false);
  });
});

describe('prioritization & determinism', () => {
  it('identical input -> identical output (order and ids)', () => {
    const cycles = [
      cycle('2026-06-01', '2026-06-05'),
      cycle('2026-06-29', '2026-07-03'),
      cycle('2026-07-29', '2026-08-02'),
    ];
    const logs = [
      log('2026-09-01', { symptoms: ['cramps'], mood: ['calm'], painLevel: 3, sleepHours: 7, hydrationMl: 2000 }),
      log('2026-09-02', { symptoms: ['cramps'], mood: ['calm'], painLevel: 4, sleepHours: 6, hydrationMl: 1500 }),
      log('2026-09-03', { symptoms: ['headache'], mood: ['happy'], painLevel: 2 }),
    ];
    const a = analyticsFor(cycles, logs);
    const dates = logs.map((l) => l.date);
    const r1 = getInsights({ analytics: a, recordedDates: dates, limit: 20 });
    const r2 = getInsights({ analytics: a, recordedDates: dates, limit: 20 });
    expect(r1.map((i) => i.id)).toEqual(r2.map((i) => i.id));
    expect(r1).toEqual(r2);
  });

  it('limit truncates deterministically (no randomness)', () => {
    const logs = [
      log('2026-09-01', { symptoms: ['cramps'], mood: ['calm'], painLevel: 3, sleepHours: 7, hydrationMl: 2000 }),
      log('2026-09-02', { symptoms: ['cramps'], mood: ['calm'], painLevel: 4, sleepHours: 6, hydrationMl: 1500 }),
      log('2026-09-03', { symptoms: ['headache'], mood: ['happy'], painLevel: 2 }),
    ];
    const a = analyticsFor([], logs);
    const dates = logs.map((l) => l.date);
    const full = getInsights({ analytics: a, recordedDates: dates, limit: 20 });
    const limited = getInsights({ analytics: a, recordedDates: dates, limit: 3 });
    expect(limited.length).toBe(3);
    expect(limited.map((i) => i.id)).toEqual(full.slice(0, 3).map((i) => i.id));
  });
});

describe('safety', () => {
  const forbidden =
    /diagnos|disease|disorder|condition|pcos|endometrios|anemia|anæmia|anaemia|hormone|dehydrat|chronic|infection|medication|treatment|abnormal|patholog/i;

  it('no insight id, key, or evidence contains diagnostic/causal language', () => {
    const cycles = [
      cycle('2026-06-01', '2026-06-05'),
      cycle('2026-06-29', '2026-07-03'),
      cycle('2026-07-29', '2026-08-02'),
    ];
    const logs = [
      log('2026-09-01', { symptoms: ['cramps', 'fatigue'], mood: ['calm', 'low'], painLevel: 7, sleepHours: 5, hydrationMl: 800 }),
      log('2026-09-02', { symptoms: ['cramps'], mood: ['calm'], painLevel: 6, sleepHours: 5, hydrationMl: 900 }),
      log('2026-09-03', { symptoms: ['headache'], mood: ['low'], painLevel: 8 }),
    ];
    const a = analyticsFor(cycles, logs);
    const r = getInsights({ analytics: a, recordedDates: logs.map((l) => l.date), limit: 50 });
    expect(r.length).toBeGreaterThan(0);
    for (const i of r) {
      expect(i.id).not.toMatch(forbidden);
      expect(i.titleKey).not.toMatch(forbidden);
      expect(i.messageKey).not.toMatch(forbidden);
      for (const e of i.evidence ?? []) {
        if (e.metric) expect(e.metric).not.toMatch(forbidden);
      }
    }
  });
});
