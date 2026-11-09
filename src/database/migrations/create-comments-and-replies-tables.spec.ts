import { CreateCommentsAndRepliesTables1762700000000 } from './1762700000000-create-comments-and-replies-tables';

describe('CreateCommentsAndRepliesTables1762700000000 migration', () => {
  it('creates the comments, reactions, mutes and reports tables and indexes', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateCommentsAndRepliesTables1762700000000().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS comments');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS comment_reactions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS comment_mutes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS comment_reports');
    expect(sql).toContain('fk_comments_post');
    expect(sql).toContain('fk_comments_user');
    expect(sql).toContain('fk_comments_parent');
    expect(sql).toContain('uq_comment_reactions_comment_user');
    expect(sql).toContain('idx_comments_post_parent');
    expect(sql).toContain('idx_comments_parent_id');
    expect(sql).toContain('idx_comments_post_pinned');
  });

  it('drops tables when rolled back', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateCommentsAndRepliesTables1762700000000().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('DROP TABLE IF EXISTS comment_reports');
    expect(sql).toContain('DROP TABLE IF EXISTS comment_mutes');
    expect(sql).toContain('DROP TABLE IF EXISTS comment_reactions');
    expect(sql).toContain('DROP TABLE IF EXISTS comments');
  });
});
