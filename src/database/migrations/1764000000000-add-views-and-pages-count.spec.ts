import { AddViewsAndPagesCount1764000000000 } from './1764000000000-add-views-and-pages-count';

describe('AddViewsAndPagesCount1764000000000 Migration', () => {
  let migration: AddViewsAndPagesCount1764000000000;
  let queryRunner: any;

  beforeEach(() => {
    migration = new AddViewsAndPagesCount1764000000000();
    queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(false),
      query: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('runs up migration to add views_count and pages_count', async () => {
    await migration.up(queryRunner);
    expect(queryRunner.hasTable).toHaveBeenCalledWith('posts');
    expect(queryRunner.hasTable).toHaveBeenCalledWith('books');
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE posts'),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE books'),
    );
  });

  it('runs down migration to drop views_count and pages_count', async () => {
    queryRunner.hasColumn.mockResolvedValue(true);
    await migration.down(queryRunner);
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN views_count'),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN pages_count'),
    );
  });
});
