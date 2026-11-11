import { MigrationInterface, QueryRunner } from 'typeorm';

export class OneAliasPerUserAnd30DayCooldown1763400000000
  implements MigrationInterface
{
  name = 'OneAliasPerUserAnd30DayCooldown1763400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_aliases')) {
      // 1. Add last_modified_at column for 30-day edit cooldown tracking
      const hasColumn = await queryRunner.hasColumn(
        'user_aliases',
        'last_modified_at',
      );
      if (!hasColumn) {
        await queryRunner.query(`
          ALTER TABLE user_aliases
          ADD COLUMN last_modified_at TIMESTAMPTZ NULL
        `);
      }

      // 2. Ensure each user has at most one alias by creating unique index on user_id
      const duplicates = await queryRunner.query(`
        SELECT user_id, COUNT(*)::int AS count
        FROM user_aliases
        GROUP BY user_id
        HAVING COUNT(*) > 1
      `);

      if (duplicates.length > 0) {
        throw new Error(
          `Cannot enforce 1-alias-per-user rule: user_aliases table has duplicate user_id records.`,
        );
      }

      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_user_aliases_user_id
        ON user_aliases (user_id)
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_aliases')) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS uq_user_aliases_user_id
      `);

      const hasColumn = await queryRunner.hasColumn(
        'user_aliases',
        'last_modified_at',
      );
      if (hasColumn) {
        await queryRunner.query(`
          ALTER TABLE user_aliases
          DROP COLUMN last_modified_at
        `);
      }
    }
  }
}
