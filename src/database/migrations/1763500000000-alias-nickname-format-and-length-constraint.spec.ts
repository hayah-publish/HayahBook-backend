import { AliasNicknameFormatAndLengthConstraint1763500000000 } from './1763500000000-alias-nickname-format-and-length-constraint';

describe('AliasNicknameFormatAndLengthConstraint1763500000000', () => {
  let migration: AliasNicknameFormatAndLengthConstraint1763500000000;
  let mockQueryRunner: any;

  beforeEach(() => {
    migration = new AliasNicknameFormatAndLengthConstraint1763500000000();
    mockQueryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
    };
  });

  it('sanitizes legacy spaces and restricts nickname to VARCHAR(30)', async () => {
    await migration.up(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining("SET nickname = REPLACE(nickname, ' ', '_')"),
    );
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ALTER COLUMN nickname TYPE VARCHAR(30)'),
    );
  });

  it('reverts column length to VARCHAR(100) in down', async () => {
    await migration.down(mockQueryRunner);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ALTER COLUMN nickname TYPE VARCHAR(100)'),
    );
  });
});

