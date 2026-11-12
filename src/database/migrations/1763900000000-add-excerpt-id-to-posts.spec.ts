import { AddExcerptIdToPosts1763900000000 } from './1763900000000-add-excerpt-id-to-posts';

describe('AddExcerptIdToPosts1763900000000 migration', () => {
  let migration: AddExcerptIdToPosts1763900000000;
  let mockQueryRunner: any;

  beforeEach(() => {
    migration = new AddExcerptIdToPosts1763900000000();
    mockQueryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(false),
      query: jest.fn().mockResolvedValue([]),
    };
  });

  it('adds excerpt_id column, foreign key constraint, and index on up', async () => {
    await migration.up(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN excerpt_id uuid'),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD CONSTRAINT fk_posts_excerpt'),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_posts_excerpt_id'),
    );
  });

  it('drops index, constraint, and column on down', async () => {
    mockQueryRunner.hasColumn.mockResolvedValue(true);
    await migration.down(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP INDEX IF EXISTS idx_posts_excerpt_id'),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE posts DROP CONSTRAINT IF EXISTS fk_posts_excerpt'),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN excerpt_id'),
    );
  });
});

