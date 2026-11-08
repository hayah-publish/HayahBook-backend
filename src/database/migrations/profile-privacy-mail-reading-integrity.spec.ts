import { ProfilePrivacyMailReadingIntegrity1762500000000 } from './1762500000000-profile-privacy-mail-reading-integrity';

describe('ProfilePrivacyMailReadingIntegrity1762500000000 migration', () => {
  it('creates privacy columns, encrypted mail outbox, and unique reading indexes', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const runner = { query, hasTable: jest.fn().mockResolvedValue(true) };
    await new ProfilePrivacyMailReadingIntegrity1762500000000().up(runner as any);
    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('show_email boolean NOT NULL DEFAULT false');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS auth_email_outbox');
    expect(sql).toContain('encrypted_payload text');
    expect(sql).toContain('uq_user_books_user_book');
    expect(sql).toContain('uq_user_books_user_audiobook');
  });

  it('refuses duplicate reading rows without deleting or changing them', async () => {
    const query = jest.fn().mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('HAVING count(*) > 1')) {
        return [{ found: true }];
      }
      return [];
    });
    const runner = { query, hasTable: jest.fn().mockResolvedValue(true) };
    await expect(new ProfilePrivacyMailReadingIntegrity1762500000000().up(runner as any))
      .rejects.toThrow('No records were changed');
    expect(query.mock.calls.some(([statement]) => String(statement).includes('DELETE FROM user_books'))).toBe(false);
  });

  it('drops the added database objects on rollback', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new ProfilePrivacyMailReadingIntegrity1762500000000().down({ query } as any);
    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('DROP TABLE IF EXISTS auth_email_outbox');
    expect(sql).toContain('DROP COLUMN IF EXISTS show_email');
  });
});
