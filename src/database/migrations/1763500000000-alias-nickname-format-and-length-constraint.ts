import { MigrationInterface, QueryRunner } from 'typeorm';

export class AliasNicknameFormatAndLengthConstraint1763500000000
  implements MigrationInterface
{
  name = 'AliasNicknameFormatAndLengthConstraint1763500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_aliases')) {
      const invalidNicknames = await queryRunner.query(`
        SELECT id, nickname FROM user_aliases
        WHERE char_length(REPLACE(nickname, ' ', '_')) > 30
        LIMIT 5
      `);
      const collisions = await queryRunner.query(`
        SELECT LOWER(REPLACE(nickname, ' ', '_')) AS nickname, COUNT(*) AS count
        FROM user_aliases
        GROUP BY LOWER(REPLACE(nickname, ' ', '_'))
        HAVING COUNT(*) > 1
        LIMIT 5
      `);
      if (invalidNicknames.length || collisions.length) {
        throw new Error(
          `Cannot constrain user_aliases.nickname: ${invalidNicknames.length} overlong names and ${collisions.length} case-insensitive collisions remain. Resolve these rows before retrying the migration.`,
        );
      }

      // 1. Sanitize any legacy nicknames with spaces into underscores
      await queryRunner.query(`
        UPDATE user_aliases
        SET nickname = REPLACE(nickname, ' ', '_')
        WHERE nickname LIKE '% %'
      `);

      // 2. Ensure nickname column length constraint is 30 characters
      await queryRunner.query(`
        ALTER TABLE user_aliases
        ALTER COLUMN nickname TYPE VARCHAR(30)
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_aliases')) {
      await queryRunner.query(`
        ALTER TABLE user_aliases
        ALTER COLUMN nickname TYPE VARCHAR(100)
      `);
    }
  }
}

