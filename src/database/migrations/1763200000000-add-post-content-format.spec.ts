import { QueryRunner } from 'typeorm';
import { AddPostContentFormat1763200000000 } from './1763200000000-add-post-content-format';

describe('AddPostContentFormat1763200000000', () => {
  let migration: AddPostContentFormat1763200000000;
  let queryRunner: QueryRunner;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new AddPostContentFormat1763200000000();
    queryMock = jest.fn().mockResolvedValue([]);
    queryRunner = {
      query: queryMock,
      hasTable: jest.fn().mockResolvedValue(true),
    } as unknown as QueryRunner;
  });

  it('runs up migration to add content_format column and backfill existing posts', async () => {
    await migration.up(queryRunner);
    expect(queryMock).toHaveBeenCalled();
    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(
      calls.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS content_format')),
    ).toBe(true);
    expect(
      calls.some((sql) => sql.includes("UPDATE posts\n        SET content_format = CASE WHEN type = 'article' THEN 'markdown' ELSE 'plain' END")),
    ).toBe(true);
  });

  it('runs down migration to drop content_format column cleanly', async () => {
    await migration.down(queryRunner);
    expect(queryMock).toHaveBeenCalled();
    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(
      calls.some((sql) => sql.includes('DROP COLUMN IF EXISTS content_format')),
    ).toBe(true);
  });
});

