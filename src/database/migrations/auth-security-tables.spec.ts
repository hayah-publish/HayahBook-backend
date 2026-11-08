import { AuthSecurityTables1762300000000 } from './1762300000000-auth-security-tables';

describe('AuthSecurityTables1762300000000 migration', () => {
  it('creates the session and shared rate-limit tables with lookup and expiry indexes', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AuthSecurityTables1762300000000().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS auth_sessions');
    expect(sql).toContain('token_hash char(64) NOT NULL UNIQUE');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS auth_rate_limits');
    expect(sql).toContain('idx_auth_sessions_user_purpose_expiry');
    expect(sql).toContain('idx_auth_rate_limits_expiry');
  });

  it('drops the two new tables when rolled back', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AuthSecurityTables1762300000000().down(queryRunner as any);

    expect(queryRunner.query.mock.calls).toEqual([
      ['DROP TABLE IF EXISTS auth_rate_limits'],
      ['DROP TABLE IF EXISTS auth_sessions'],
    ]);
  });
});
