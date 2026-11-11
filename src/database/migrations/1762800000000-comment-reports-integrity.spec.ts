import { CommentReportsIntegrity1762800000000 } from './1762800000000-comment-reports-integrity';

describe('CommentReportsIntegrity1762800000000 migration', () => {
  it('cleans duplicates and orphans, then installs unique and cascading constraints', async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    };
    await new CommentReportsIntegrity1762800000000().up(runner as any);
    const sql = runner.query.mock.calls.map(([q]) => q).join('\n');
    expect(sql).toContain('row_number() OVER');
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM users');
    expect(sql).toContain('uq_comment_reports_comment_user');
    expect(sql).toContain('ON DELETE CASCADE');
  });

  it('rolls back only the added user constraint and unique index', async () => {
    const runner = { query: jest.fn().mockResolvedValue(undefined) };
    await new CommentReportsIntegrity1762800000000().down(runner as any);
    const sql = runner.query.mock.calls.map(([q]) => q).join('\n');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS fk_comment_reports_user');
    expect(sql).toContain(
      'DROP INDEX IF EXISTS uq_comment_reports_comment_user',
    );
    expect(sql).not.toContain('DROP TABLE');
  });
});
