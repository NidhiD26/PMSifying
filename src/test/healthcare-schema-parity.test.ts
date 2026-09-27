import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { HEALTHCARE_LIMITS } from '../lib/healthcare/validation';

/**
 * The request contract and the database schema are two copies of the same numbers,
 * and copies drift. It already happened once: `health_cases.summary` was 500 in the
 * migration and 1000 in Zod, which meant a summary of 700 characters was accepted by
 * the API, sent to Postgres, and rejected there — reported to a health worker as a
 * server error on input she had been told was valid.
 *
 * So the numbers are checked against the SQL rather than trusted. A limit here may
 * be stricter than the column, never looser: refusing early produces a message naming
 * the field, and letting Postgres refuse produces a 502.
 */
const MIGRATION = readFileSync('supabase/migrations/0003_healthcare_schema.sql', 'utf8');

/**
 * The upper bound of every `char_length` check on a text column, keyed `table.column`.
 *
 * Reads the migration rather than restating it, which is the point: a migration that
 * widens a column is picked up here with no edit to this file. Both bounds of a
 * `between` are captured, and the looser one wins.
 *
 * The `char_length` argument has to be allowed to contain its own parentheses -
 * `char_length(btrim(full_name))` - so the check is read to the end of the line
 * instead of to the first `)`. A version that stopped early would find nothing at
 * all, which is why the extraction is asserted on separately below.
 */
function sqlCharLengthBounds(): Map<string, number> {
  // A commented-out column would otherwise be read as a real one.
  const sql = MIGRATION.replace(/--[^\n]*/g, '');
  const bounds = new Map<string, number>();

  for (const table of sql.matchAll(/create table if not exists public\.(\w+) \(/g)) {
    const tableName = table[1];
    if (!tableName) continue;
    const start = (table.index ?? 0) + table[0].length;
    const end = sql.indexOf('\n);', start);
    const body = sql.slice(start, end === -1 ? sql.length : end);

    for (const column of body.matchAll(/^\s*(\w+)\s+text\b.*?check\s*\((.+)\),?\s*$/gim)) {
      const [, columnName, check] = column;
      if (!columnName || !check || !check.includes('char_length')) continue;
      const lengths = [...check.matchAll(/char_length\([^)]*(?:\)[^)]*)*\)\s*<=\s*(\d+)/g)].map(
        (m) => Number(m[1])
      );
      const betweens = [...check.matchAll(/char_length\([^)]*(?:\)[^)]*)*\)\s+between\s+1\s+and\s+(\d+)/gi)]
        .map((m) => Number(m[1]));
      const bound = Math.max(0, ...lengths, ...betweens);
      if (bound > 0) bounds.set(`${tableName}.${columnName}`, bound);
    }
  }
  return bounds;
}

/** The same bounds, as declared in Zod. */
function declaredBounds(): Map<string, number> {
  const declared = new Map<string, number>();
  for (const [table, columns] of Object.entries(HEALTHCARE_LIMITS)) {
    // `counts` holds the numeric constraints, which are compared by name below
    // rather than by column, so it has no place in a table.column map.
    if (table === 'counts') continue;
    for (const [column, bound] of Object.entries(columns)) {
      declared.set(`${table}.${column}`, bound as number);
    }
  }
  return declared;
}

describe('healthcare request limits against the migration', () => {
  const sql = sqlCharLengthBounds();
  const declared = declaredBounds();

  it('finds the healthcare tables in the migration', () => {
    // A regex that quietly matches nothing would make every other test in this file
    // pass for the wrong reason, so the extraction is asserted on its own.
    expect(sql.size).toBeGreaterThan(20);
    expect(sql.get('health_cases.summary')).toBe(500);
  });

  it('bounds every column the schema constrains', () => {
    const undeclared = [...sql.keys()].filter((column) => !declared.has(column));
    expect(undeclared).toEqual([]);
  });

  it('never allows more than the column does', () => {
    const looser: string[] = [];
    for (const [column, sqlBound] of sql) {
      const declaredBound = declared.get(column);
      if (declaredBound === undefined) continue;
      if (declaredBound > sqlBound) looser.push(`${column}: ${declaredBound} > ${sqlBound}`);
    }
    expect(looser).toEqual([]);
  });

  it('declares nothing the schema does not constrain', () => {
    // The other direction. A limit left behind for a column that no longer has a
    // check reads as protection and is not: it survives every migration, keeps
    // looking meaningful in review, and guards nothing.
    const stale = [...declared.keys()].filter((column) => !sql.has(column));
    expect(stale).toEqual([]);
  });

  it('constrains the columns the schema bounds numerically', () => {
    const { counts } = HEALTHCARE_LIMITS;
    expect(counts.health_camps_capacity).toBe(
      expectNumber(/capacity integer not null check \(capacity between 1 and (\d+)\)/i)
    );
    expect(counts.case_observations_reported_symptoms).toBe(
      expectNumber(
        /check \(coalesce\(array_length\(reported_symptoms, 1\), 0\) between 1 and (\d+)\)/
      )
    );
    expect(counts.household_members_age_years).toBe(
      expectNumber(/age_years integer check \(age_years is null or age_years between 0 and (\d+)\)/)
    );
    expect(counts.case_observations_duration_days).toBe(
      expectNumber(
        /duration_days integer check \(duration_days is null or duration_days between 0 and (\d+)\)/
      )
    );
  });

  /** Reads a bound out of the migration, failing loudly if the check has been renamed. */
  function expectNumber(pattern: RegExp): number {
    const match = MIGRATION.match(pattern);
    expect(match, `no match in the migration for ${pattern}`).not.toBeNull();
    return Number(match?.[1]);
  }
});
