import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db/dexie-db';
import { CycleRepository } from '../lib/db/repositories/cycle-repository';

describe('Period Logging Feature (Offline Repository Integration)', () => {
  beforeEach(async () => {
    await db.cycles.clear();
  });

  it('initially returns an empty cycle array from repository', async () => {
    const records = await CycleRepository.getAllCyclesChronological();
    expect(records).toEqual([]);
  });

  it('creates a period entry via CycleRepository and confirms local storage persistence', async () => {
    const id = await CycleRepository.createCycle({
      startDate: '2026-08-10',
      endDate: '2026-08-15',
      flow: 'medium',
      notes: 'Logged period test',
    });

    expect(id).toBeGreaterThan(0);

    const cycles = await CycleRepository.getAllCyclesChronological();
    expect(cycles.length).toBe(1);
    expect(cycles[0].startDate).toBe('2026-08-10');
    expect(cycles[0].endDate).toBe('2026-08-15');
    expect(cycles[0].flow).toBe('medium');
  });

  it('edits an existing period entry via CycleRepository', async () => {
    const id = await CycleRepository.createCycle({
      startDate: '2026-08-10',
      endDate: '2026-08-14',
      flow: 'light',
    });

    await CycleRepository.updateCycle(id, {
      endDate: '2026-08-16',
      flow: 'heavy',
    });

    const updated = await CycleRepository.getCycleById(id);
    expect(updated?.endDate).toBe('2026-08-16');
    expect(updated?.flow).toBe('heavy');
  });

  it('deletes a period entry via CycleRepository', async () => {
    const id = await CycleRepository.createCycle({
      startDate: '2026-08-10',
      endDate: '2026-08-15',
    });

    await CycleRepository.deleteCycle(id);
    const records = await CycleRepository.getAllCyclesChronological();
    expect(records).toEqual([]);
  });
});
