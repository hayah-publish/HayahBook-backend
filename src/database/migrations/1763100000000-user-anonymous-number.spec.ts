import { QueryRunner } from 'typeorm';
import { UserAnonymousNumber1763100000000 } from './1763100000000-user-anonymous-number';

describe('UserAnonymousNumber1763100000000', () => {
  let migration: UserAnonymousNumber1763100000000;
  let queryRunner: QueryRunner;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new UserAnonymousNumber1763100000000();
    queryMock = jest.fn().mockResolvedValue([]);
    queryRunner = {
      query: queryMock,
      hasTable: jest.fn().mockResolvedValue(true),
    } as unknown as QueryRunner;
  });

  it('runs up migration to add anonymous_number column, unique index, and backfill', async () => {
    await migration.up(queryRunner);
    expect(queryMock).toHaveBeenCalled();
    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS anonymous_number'))).toBe(true);
    expect(calls.some((sql) => sql.includes('uq_users_anonymous_number'))).toBe(true);
    expect(calls.some((sql) => sql.includes('DO $$'))).toBe(true);
  });

  it('runs down migration to drop index and column cleanly', async () => {
    await migration.down(queryRunner);
    expect(queryMock).toHaveBeenCalled();
    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((sql) => sql.includes('DROP INDEX IF EXISTS uq_users_anonymous_number'))).toBe(true);
    expect(calls.some((sql) => sql.includes('DROP COLUMN IF EXISTS anonymous_number'))).toBe(true);
  });
});
