import { QueryRunner } from 'typeorm';
import { UserAliasesAndCommentIdentity1763000000000 } from './1763000000000-user-aliases-and-comment-identity';

describe('UserAliasesAndCommentIdentity1763000000000', () => {
  let migration: UserAliasesAndCommentIdentity1763000000000;
  let queryRunner: QueryRunner;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new UserAliasesAndCommentIdentity1763000000000();
    queryMock = jest.fn().mockResolvedValue([]);
    queryRunner = {
      query: queryMock,
      hasTable: jest.fn().mockResolvedValue(true),
    } as unknown as QueryRunner;
  });

  it('runs up migration to create user_aliases and add identity columns', async () => {
    await migration.up(queryRunner);
    expect(queryMock).toHaveBeenCalled();
    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS user_aliases'))).toBe(true);
    expect(calls.some((sql) => sql.includes('identity_type'))).toBe(true);
    expect(calls.some((sql) => sql.includes('alias_id'))).toBe(true);
  });

  it('runs down migration to drop table and columns cleanly', async () => {
    await migration.down(queryRunner);
    expect(queryMock).toHaveBeenCalled();
    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((sql) => sql.includes('DROP TABLE IF EXISTS user_aliases'))).toBe(true);
  });
});

