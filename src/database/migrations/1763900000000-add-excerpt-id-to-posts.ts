import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExcerptIdToPosts1763900000000 implements MigrationInterface {
  name = 'AddExcerptIdToPosts1763900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('posts')) {
      const hasColumn = await queryRunner.hasColumn('posts', 'excerpt_id');
      if (!hasColumn) {
        await queryRunner.query(`
          ALTER TABLE posts
          ADD COLUMN excerpt_id uuid
        `);
      }

      await queryRunner.query(`
        DO $$ BEGIN
          IF to_regclass('public.user_book_excerpts') IS NOT NULL THEN
            ALTER TABLE posts
            ADD CONSTRAINT fk_posts_excerpt
            FOREIGN KEY (excerpt_id) REFERENCES user_book_excerpts(id) ON DELETE SET NULL;
          END IF;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_excerpt_id
        ON posts (excerpt_id)
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('posts')) {
      await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_excerpt_id`);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE posts DROP CONSTRAINT IF EXISTS fk_posts_excerpt;
        EXCEPTION WHEN undefined_object THEN NULL;
        END $$;
      `);
      const hasColumn = await queryRunner.hasColumn('posts', 'excerpt_id');
      if (hasColumn) {
        await queryRunner.query(`
          ALTER TABLE posts
          DROP COLUMN excerpt_id
        `);
      }
    }
  }
}
