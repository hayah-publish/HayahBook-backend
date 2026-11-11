import { CreateUserBookExcerptsTable1763700000000 } from './1763700000000-create-user-book-excerpts-table';

describe('CreateUserBookExcerptsTable1763700000000 migration', () => {
  it('creates user_book_excerpts table, foreign keys, and indexes', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateUserBookExcerptsTable1763700000000().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS user_book_excerpts');
    expect(sql).toContain('content text NOT NULL');
    expect(sql).toContain('note text');
    expect(sql).toContain('chapter varchar(150)');
    expect(sql).toContain('page_number integer');
    expect(sql).toContain('color varchar(30) NOT NULL DEFAULT \'#FF7A00\'');
    expect(sql).toContain('cfi_range varchar(255)');
    expect(sql).toContain('fk_user_book_excerpts_user');
    expect(sql).toContain('fk_user_book_excerpts_book');
    expect(sql).toContain('idx_user_book_excerpts_user_book');
    expect(sql).toContain('idx_user_book_excerpts_user_created');
    expect(sql).toContain('idx_user_book_excerpts_book');
  });

  it('drops user_book_excerpts table and indexes on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateUserBookExcerptsTable1763700000000().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('DROP TABLE IF EXISTS user_book_excerpts CASCADE');
    expect(sql).toContain('DROP INDEX IF EXISTS idx_user_book_excerpts_book');
    expect(sql).toContain('DROP INDEX IF EXISTS idx_user_book_excerpts_user_created');
    expect(sql).toContain('DROP INDEX IF EXISTS idx_user_book_excerpts_user_book');
  });
});
