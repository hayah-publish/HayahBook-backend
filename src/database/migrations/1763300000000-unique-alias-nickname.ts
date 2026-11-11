import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueAliasNickname1763300000000 implements MigrationInterface {
  name = 'UniqueAliasNickname1763300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_aliases')) {
      const duplicates = await queryRunner.query(`
        SELECT LOWER(nickname) AS normalized_nickname, COUNT(*)::int AS row_count
        FROM user_aliases
        GROUP BY LOWER(nickname)
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `);
      if (duplicates.length > 0) {
        const examples = duplicates
          .map(
            (duplicate: { normalized_nickname: string; row_count: number }) =>
              `${duplicate.normalized_nickname} (${duplicate.row_count})`,
          )
          .join(', ');
        throw new Error(
          `Cannot create case-insensitive alias nickname index: resolve duplicate nicknames first. Examples: ${examples}`,
        );
      }
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_user_aliases_nickname_lower
        ON user_aliases (LOWER(nickname))
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_aliases')) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS uq_user_aliases_nickname_lower
      `);
    }
  }
}
