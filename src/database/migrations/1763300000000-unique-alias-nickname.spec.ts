import { QueryRunner } from 'typeorm';
import { UniqueAliasNickname1763300000000 } from './1763300000000-unique-alias-nickname';

describe('UniqueAliasNickname1763300000000', () => {
  let migration: UniqueAliasNickname1763300000000;
  let queryRunner: QueryRunner;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new UniqueAliasNickname1763300000000();
    queryMock = jest.fn().mockResolvedValue([]);
    queryRunner = {
      query: queryMock,
      hasTable: jest.fn().mockResolvedValue(true),
    } as unknown as QueryRunner;
  });

  it('runs up migration to create case-insensitive unique index on nickname', async () => {
    await migration.up(queryRunner);
    expect(queryMock).toHaveBeenCalled();
    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(
      calls.some((sql) => sql.includes('uq_user_aliases_nickname_lower')),
    ).toBe(true);
    expect(
      calls.some((sql) => sql.includes('ON user_aliases (LOWER(nickname))')),
    ).toBe(true);
  });

  it('runs down migration to drop unique index cleanly', async () => {
    await migration.down(queryRunner);
    expect(queryMock).toHaveBeenCalled();
    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(
      calls.some((sql) => sql.includes('DROP INDEX IF EXISTS uq_user_aliases_nickname_lower')),
    ).toBe(true);
  });
});

