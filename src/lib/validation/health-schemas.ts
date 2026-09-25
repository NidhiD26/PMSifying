import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(s: string): boolean {
  if (!isoDateRegex.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

export const flowLevelSchema = z.enum(['spotting', 'light', 'medium', 'heavy']);

export const symptomEntrySchema = z.object({
  id: z.string().min(1).max(50),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  notes: z.string().max(200).optional(),
});

export const moodEntrySchema = z.object({
  id: z.string().min(1).max(50),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
});

export const cycleSchema = z.object({
  id: z.number().optional(),
  startDate: z.string().regex(isoDateRegex, 'startDate must be YYYY-MM-DD format'),
  endDate: z.string().regex(isoDateRegex, 'endDate must be YYYY-MM-DD format').optional(),
  cycleLength: z.number().int().min(1).max(100).optional(),
  periodLength: z.number().int().min(1).max(30).optional(),
  flow: flowLevelSchema.optional(),
  notes: z.string().max(1000).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).refine((data) => {
  if (data.endDate && data.startDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}, {
  message: 'endDate cannot be before startDate',
  path: ['endDate'],
});

export const dailyLogSchema = z.object({
  id: z.number().optional(),
  date: z.string().regex(isoDateRegex, 'date must be YYYY-MM-DD format').refine(isValidCalendarDate, 'date must be a valid calendar date'),
  symptoms: z.array(symptomEntrySchema),
  mood: z.array(moodEntrySchema),
  painLevel: z.number().min(0).max(10),
  sleepHours: z.number().min(0).max(24),
  hydrationMl: z.number().min(0).max(10000),
  notes: z.string().max(2000).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).superRefine((data, ctx) => {
  const symptomIds = data.symptoms.map((s) => s.id);
  const seenSymptoms = new Set<string>();
  for (const id of symptomIds) {
    if (seenSymptoms.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate symptom entries are not allowed',
        path: ['symptoms'],
      });
      break;
    }
    seenSymptoms.add(id);
  }

  const moodIds = data.mood.map((m) => m.id);
  const seenMoods = new Set<string>();
  for (const id of moodIds) {
    if (seenMoods.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate mood entries are not allowed',
        path: ['mood'],
      });
      break;
    }
    seenMoods.add(id);
  }
});
