import { OneAliasPerUserAnd30DayCooldown1763400000000 } from './1763400000000-one-alias-per-user-and-30-day-cooldown';

describe('OneAliasPerUserAnd30DayCooldown1763400000000', () => {
  let migration: OneAliasPerUserAnd30DayCooldown1763400000000;
  let mockQueryRunner: any;

  beforeEach(() => {
    migration = new OneAliasPerUserAnd30DayCooldown1763400000000();
    mockQueryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(false),
      query: jest.fn().mockResolvedValue([]),
    };
  });

  it('adds last_modified_at and creates unique index on user_id', async () => {
    await migration.up(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE user_aliases'),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS uq_user_aliases_user_id'),
    );
  });

  it('throws an error during up if duplicate user_id records exist', async () => {
    mockQueryRunner.query.mockImplementation((sql: string) => {
      if (sql.includes('GROUP BY user_id')) {
        return Promise.resolve([{ user_id: 'u-1', count: 2 }]);
      }
      return Promise.resolve([]);
    });

    await expect(migration.up(mockQueryRunner)).rejects.toThrow(
      'Cannot enforce 1-alias-per-user rule',
    );
  });

  it('drops unique index and column during down', async () => {
    mockQueryRunner.hasColumn.mockResolvedValue(true);
    await migration.down(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP INDEX IF EXISTS uq_user_aliases_user_id'),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN last_modified_at'),
    );
  });
});

