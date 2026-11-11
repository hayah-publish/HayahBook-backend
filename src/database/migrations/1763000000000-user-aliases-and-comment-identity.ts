import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAliasesAndCommentIdentity1763000000000 implements MigrationInterface {
  name = 'UserAliasesAndCommentIdentity1763000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. user_aliases table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_aliases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        nickname VARCHAR(100) NOT NULL,
        avatar_url VARCHAR(500) NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        agreed_count INT NOT NULL DEFAULT 0,
        search_count INT NOT NULL DEFAULT 0,
        comments_count INT NOT NULL DEFAULT 0,
        reviews_count INT NOT NULL DEFAULT 0,
        ratings_count INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT fk_user_aliases_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_aliases_user_id
      ON user_aliases (user_id)
    `);
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY "createdAt" ASC, id ASC) AS position
        FROM user_aliases WHERE is_default = true
      )
      UPDATE user_aliases AS alias SET is_default = false
      FROM ranked WHERE alias.id = ranked.id AND ranked.position > 1
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_aliases_one_default ON user_aliases(user_id) WHERE is_default = true`,
    );

    // 2. update comments table
    if (await queryRunner.hasTable('comments')) {
      await queryRunner.query(`
        ALTER TABLE comments
        ADD COLUMN IF NOT EXISTS identity_type VARCHAR(20) NOT NULL DEFAULT 'primary',
        ADD COLUMN IF NOT EXISTS alias_id UUID NULL,
        ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_alias'
          ) THEN
            ALTER TABLE comments
            ADD CONSTRAINT fk_comments_alias FOREIGN KEY (alias_id) REFERENCES user_aliases(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_comments_alias_id
        ON comments (alias_id)
      `);
    }

    // 3. update user_books table
    if (await queryRunner.hasTable('user_books')) {
      await queryRunner.query(`
        ALTER TABLE user_books
        ADD COLUMN IF NOT EXISTS identity_type VARCHAR(20) NOT NULL DEFAULT 'primary',
        ADD COLUMN IF NOT EXISTS alias_id UUID NULL
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_books_alias'
          ) THEN
            ALTER TABLE user_books
            ADD CONSTRAINT fk_user_books_alias FOREIGN KEY (alias_id) REFERENCES user_aliases(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_user_books_alias_id
        ON user_books (alias_id)
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_books')) {
      await queryRunner.query(`
        ALTER TABLE user_books
        DROP CONSTRAINT IF EXISTS fk_user_books_alias,
        DROP COLUMN IF EXISTS alias_id,
        DROP COLUMN IF EXISTS identity_type
      `);
    }

    if (await queryRunner.hasTable('comments')) {
      await queryRunner.query(`
        ALTER TABLE comments
        DROP CONSTRAINT IF EXISTS fk_comments_alias,
        DROP COLUMN IF EXISTS is_anonymous,
        DROP COLUMN IF EXISTS alias_id,
        DROP COLUMN IF EXISTS identity_type
      `);
    }

    await queryRunner.query(`DROP INDEX IF EXISTS uq_user_aliases_one_default`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_aliases CASCADE`);
  }
}
