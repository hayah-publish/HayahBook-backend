import { CreateBookmarksTable1762400000000 } from './1762400000000-create-bookmarks-table';

describe('CreateBookmarksTable1762400000000 migration', () => {
  it('creates the user_bookmarks table, indexes and bookmarks_count column', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateBookmarksTable1762400000000().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS user_bookmarks');
    expect(sql).toContain('uq_user_bookmarks_user_post');
    expect(sql).toContain('idx_user_bookmarks_user_created');
    expect(sql).toContain('idx_user_bookmarks_post');
    expect(sql).toContain('bookmarks_count integer DEFAULT 0');
  });

  it('drops user_bookmarks table and bookmarks_count column when rolled back', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateBookmarksTable1762400000000().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('DROP TABLE IF EXISTS user_bookmarks');
    expect(sql).toContain('ALTER TABLE posts DROP COLUMN IF EXISTS bookmarks_count');
  });
});

