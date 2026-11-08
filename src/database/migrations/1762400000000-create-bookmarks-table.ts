import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookmarksTable1762400000000 implements MigrationInterface {
  name = 'CreateBookmarksTable1762400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_bookmarks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        post_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_bookmarks_user_post UNIQUE (user_id, post_id)
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE user_bookmarks
          ADD CONSTRAINT fk_user_bookmarks_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.posts') IS NOT NULL THEN
          ALTER TABLE user_bookmarks
          ADD CONSTRAINT fk_user_bookmarks_post
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_created
      ON user_bookmarks (user_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_bookmarks_post
      ON user_bookmarks (post_id)
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.posts') IS NOT NULL THEN
          ALTER TABLE posts
          ADD COLUMN IF NOT EXISTS bookmarks_count integer DEFAULT 0;
        END IF;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_bookmarks`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.posts') IS NOT NULL THEN
          ALTER TABLE posts DROP COLUMN IF EXISTS bookmarks_count;
        END IF;
      END $$
    `);
  }
}
