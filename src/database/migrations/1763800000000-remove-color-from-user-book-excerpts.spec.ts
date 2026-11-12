import { RemoveColorFromUserBookExcerpts1763800000000 } from './1763800000000-remove-color-from-user-book-excerpts';

describe('RemoveColorFromUserBookExcerpts1763800000000', () => {
  let migration: RemoveColorFromUserBookExcerpts1763800000000;
  let mockQueryRunner: any;

  beforeEach(() => {
    migration = new RemoveColorFromUserBookExcerpts1763800000000();
    mockQueryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
    };
  });

  it('drops color column on up when table and column exist', async () => {
    await migration.up(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN color'),
    );
  });

  it('adds color column on down when column does not exist', async () => {
    mockQueryRunner.hasColumn.mockResolvedValue(false);
    await migration.down(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining("ADD COLUMN color varchar(30) NOT NULL DEFAULT '#FF7A00'"),
    );
  });
});
