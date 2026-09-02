import { db } from '../dexie-db';
import { cycleSchema } from '@/lib/validation/health-schemas';
import { CycleDomainModel, RepositoryError } from '@/types/health';

export const CycleRepository = {
  async createCycle(cycle: Omit<CycleDomainModel, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString();
    const payload = {
      ...cycle,
      createdAt: now,
      updatedAt: now,
    };

    const validation = cycleSchema.safeParse(payload);
    if (!validation.success) {
      throw new RepositoryError(
        `Invalid cycle data: ${validation.error.errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    try {
      const id = await db.cycles.add(validation.data as CycleDomainModel);
      return id as number;
    } catch (err) {
      throw new RepositoryError(`Failed to save cycle: ${(err as Error).message}`, 'STORAGE_ERROR');
    }
  },

  async getCycleById(id: number): Promise<CycleDomainModel | undefined> {
    try {
      return await db.cycles.get(id);
    } catch (err) {
      throw new RepositoryError(`Failed to retrieve cycle #${id}: ${(err as Error).message}`, 'STORAGE_ERROR');
    }
  },

  async getAllCyclesChronological(): Promise<CycleDomainModel[]> {
    try {
      return await db.cycles.orderBy('startDate').toArray();
    } catch (err) {
      throw new RepositoryError(`Failed to retrieve cycle history: ${(err as Error).message}`, 'STORAGE_ERROR');
    }
  },

  async updateCycle(id: number, updates: Partial<CycleDomainModel>): Promise<void> {
    const existing = await this.getCycleById(id);
    if (!existing) {
      throw new RepositoryError(`Cycle #${id} not found`, 'NOT_FOUND');
    }

    const updatedPayload = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    const validation = cycleSchema.safeParse(updatedPayload);
    if (!validation.success) {
      throw new RepositoryError(
        `Invalid cycle update: ${validation.error.errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    try {
      await db.cycles.put(validation.data as CycleDomainModel);
    } catch (err) {
      throw new RepositoryError(`Failed to update cycle #${id}: ${(err as Error).message}`, 'STORAGE_ERROR');
    }
  },

  async deleteCycle(id: number): Promise<void> {
    try {
      await db.cycles.delete(id);
    } catch (err) {
      throw new RepositoryError(`Failed to delete cycle #${id}: ${(err as Error).message}`, 'STORAGE_ERROR');
    }
  },
};
