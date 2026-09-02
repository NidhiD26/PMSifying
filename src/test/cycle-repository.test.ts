import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db/dexie-db';
import { CycleRepository } from '../lib/db/repositories/cycle-repository';
import { RepositoryError } from '../types/health';

describe('CycleRepository (Local Offline Data Isolation)', () => {
  beforeEach(async () => {
    await db.cycles.clear();
  });

  it('creates, retrieves, updates, and deletes a cycle entity', async () => {
    // Create
    const id = await CycleRepository.createCycle({
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      flow: 'medium',
      notes: 'Initial cycle test log',
    });
    expect(id).toBeDefined();

    // Read by ID
    const cycle = await CycleRepository.getCycleById(id);
    expect(cycle).toBeDefined();
    expect(cycle?.startDate).toBe('2026-08-01');
    expect(cycle?.flow).toBe('medium');

    // Update
    await CycleRepository.updateCycle(id, { flow: 'heavy', periodLength: 5 });
    const updated = await CycleRepository.getCycleById(id);
    expect(updated?.flow).toBe('heavy');
    expect(updated?.periodLength).toBe(5);

    // Delete
    await CycleRepository.deleteCycle(id);
    const deleted = await CycleRepository.getCycleById(id);
    expect(deleted).toBeUndefined();
  });

  it('retrieves cycle records in chronological history order', async () => {
    await CycleRepository.createCycle({ startDate: '2026-07-01', endDate: '2026-07-05' });
    await CycleRepository.createCycle({ startDate: '2026-05-01', endDate: '2026-05-05' });
    await CycleRepository.createCycle({ startDate: '2026-06-01', endDate: '2026-06-05' });

    const history = await CycleRepository.getAllCyclesChronological();
    expect(history.length).toBe(3);
    expect(history[0].startDate).toBe('2026-05-01');
    expect(history[1].startDate).toBe('2026-06-01');
    expect(history[2].startDate).toBe('2026-07-01');
  });

  it('rejects invalid dates and invalid range via Zod validation', async () => {
    // Malformed date
    await expect(
      CycleRepository.createCycle({ startDate: 'invalid-date' })
    ).rejects.toThrow(RepositoryError);

    // End date before start date
    await expect(
      CycleRepository.createCycle({ startDate: '2026-08-10', endDate: '2026-08-01' })
    ).rejects.toThrow(RepositoryError);
  });
});
