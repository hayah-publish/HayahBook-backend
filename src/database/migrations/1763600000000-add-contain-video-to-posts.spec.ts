import { AddContainVideoToPosts1763600000000 } from './1763600000000-add-contain-video-to-posts';

describe('AddContainVideoToPosts1763600000000', () => {
  let migration: AddContainVideoToPosts1763600000000;
  let mockQueryRunner: any;

  beforeEach(() => {
    migration = new AddContainVideoToPosts1763600000000();
    mockQueryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(false),
      query: jest.fn().mockResolvedValue([]),
    };
  });

  it('adds contain_video column, backfills data, and creates index on up', async () => {
    await migration.up(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN contain_video BOOLEAN NOT NULL DEFAULT FALSE'),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE posts'),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_posts_contain_video'),
    );
  });

  it('drops index and column on down', async () => {
    mockQueryRunner.hasColumn.mockResolvedValue(true);
    await migration.down(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP INDEX IF EXISTS idx_posts_contain_video'),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN contain_video'),
    );
  });
});

