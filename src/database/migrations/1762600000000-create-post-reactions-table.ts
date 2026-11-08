import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePostReactionsTable1762600000000 implements MigrationInterface {
  name = 'CreatePostReactionsTable1762600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS post_reactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id uuid NOT NULL,
        user_id uuid NOT NULL,
        reaction_type varchar(20) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_post_reactions_post_user UNIQUE (post_id, user_id)
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE post_reactions
          ADD CONSTRAINT fk_post_reactions_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.posts') IS NOT NULL THEN
          ALTER TABLE post_reactions
          ADD CONSTRAINT fk_post_reactions_post
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_post_reactions_post_type
      ON post_reactions (post_id, reaction_type)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_post_reactions_post_created
      ON post_reactions (post_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_post_reactions_user
      ON post_reactions (user_id)
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.posts') IS NOT NULL THEN
          ALTER TABLE posts
          ADD COLUMN IF NOT EXISTS reactions_count jsonb DEFAULT '{"total":0,"agree":0,"love":0,"applaud":0,"insightful":0,"disagree":0}'::jsonb;
        END IF;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS post_reactions`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.posts') IS NOT NULL THEN
          ALTER TABLE posts DROP COLUMN IF EXISTS reactions_count;
        END IF;
      END $$
    `);
  }
}
