import { CreatePostReactionsTable1762600000000 } from './1762600000000-create-post-reactions-table';

describe('CreatePostReactionsTable1762600000000 migration', () => {
  it('creates the post_reactions table, indexes and reactions_count column', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreatePostReactionsTable1762600000000().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS post_reactions');
    expect(sql).toContain('uq_post_reactions_post_user');
    expect(sql).toContain('idx_post_reactions_post_type');
    expect(sql).toContain('idx_post_reactions_post_created');
    expect(sql).toContain('idx_post_reactions_user');
    expect(sql).toContain('reactions_count jsonb');
  });

  it('drops post_reactions table and reactions_count column when rolled back', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreatePostReactionsTable1762600000000().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('DROP TABLE IF EXISTS post_reactions');
    expect(sql).toContain('ALTER TABLE posts DROP COLUMN IF EXISTS reactions_count');
  });
});
