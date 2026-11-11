import { MigrationInterface, QueryRunner } from 'typeorm';

export class AliasNicknameFormatAndLengthConstraint1763500000000
  implements MigrationInterface
{
  name = 'AliasNicknameFormatAndLengthConstraint1763500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_aliases')) {
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

