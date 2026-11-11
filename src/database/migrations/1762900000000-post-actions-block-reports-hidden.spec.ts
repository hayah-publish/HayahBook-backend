import { PostActionsBlockReportsHidden1762900000000 } from './1762900000000-post-actions-block-reports-hidden';

describe('PostActionsBlockReportsHidden1762900000000 migration', () => {
  it('installs comments_disabled column, user_blocks, user_hidden_posts, and post_reports tables with unique constraints', async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    };
    await new PostActionsBlockReportsHidden1762900000000().up(runner as any);
    const sql = runner.query.mock.calls.map(([q]) => q).join('\n');
    expect(sql).toContain('comments_disabled');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS user_blocks');
    expect(sql).toContain('uq_user_blocks_blocker_blocked');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS user_hidden_posts');
    expect(sql).toContain('uq_user_hidden_posts_user_post');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS post_reports');
    expect(sql).toContain('uq_post_reports_post_user');
  });

  it('drops tables and column on down rollback', async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    };
    await new PostActionsBlockReportsHidden1762900000000().down(runner as any);
    const sql = runner.query.mock.calls.map(([q]) => q).join('\n');
    expect(sql).toContain('DROP TABLE IF EXISTS post_reports');
    expect(sql).toContain('DROP TABLE IF EXISTS user_hidden_posts');
    expect(sql).toContain('DROP TABLE IF EXISTS user_blocks');
    expect(sql).toContain('comments_disabled');
  });
});

