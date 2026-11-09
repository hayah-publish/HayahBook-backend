import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommentsAndRepliesTables1762700000000 implements MigrationInterface {
  name = 'CreateCommentsAndRepliesTables1762700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Comments Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id uuid NOT NULL,
        user_id uuid NOT NULL,
        parent_id uuid NULL,
        reply_to_user_id uuid NULL,
        content text NOT NULL,
        image_url text NULL,
        mentions jsonb NOT NULL DEFAULT '[]'::jsonb,
        replies_count integer NOT NULL DEFAULT 0,
        likes_count integer NOT NULL DEFAULT 0,
        reactions_count jsonb NOT NULL DEFAULT '{"total":0,"agree":0,"love":0,"applaud":0,"insightful":0,"disagree":0}'::jsonb,
        is_pinned boolean NOT NULL DEFAULT false,
        pinned_at timestamptz NULL,
        is_hidden boolean NOT NULL DEFAULT false,
        is_edited boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 2. Comment Reactions Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS comment_reactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        comment_id uuid NOT NULL,
        user_id uuid NOT NULL,
        reaction_type varchar(20) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_comment_reactions_comment_user UNIQUE (comment_id, user_id)
      )
    `);

    // 3. Comment Mutes Table (mute notifications for a comment thread)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS comment_mutes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        comment_id uuid NOT NULL,
        user_id uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_comment_mutes_comment_user UNIQUE (comment_id, user_id)
      )
    `);

    // 4. Comment Reports Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS comment_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        comment_id uuid NOT NULL,
        user_id uuid NOT NULL,
        reason text NULL,
        details varchar(160) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Ensure camelCase column names for compatibility across all environments
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'created_at') THEN
          ALTER TABLE comments RENAME COLUMN created_at TO "createdAt";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'updated_at') THEN
          ALTER TABLE comments RENAME COLUMN updated_at TO "updatedAt";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comment_reactions' AND column_name = 'created_at') THEN
          ALTER TABLE comment_reactions RENAME COLUMN created_at TO "createdAt";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comment_mutes' AND column_name = 'created_at') THEN
          ALTER TABLE comment_mutes RENAME COLUMN created_at TO "createdAt";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comment_reports' AND column_name = 'created_at') THEN
          ALTER TABLE comment_reports RENAME COLUMN created_at TO "createdAt";
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comment_reports' AND column_name = 'details') THEN
          ALTER TABLE comment_reports ADD COLUMN details varchar(160) NULL;
        END IF;
      END $$;
    `);

    // Foreign Keys with conditional checks
    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.posts') IS NOT NULL THEN
          ALTER TABLE comments
          ADD CONSTRAINT fk_comments_post
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE comments
          ADD CONSTRAINT fk_comments_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE comments
        ADD CONSTRAINT fk_comments_parent
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE comments
          ADD CONSTRAINT fk_comments_reply_to_user
          FOREIGN KEY (reply_to_user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE comment_reactions
        ADD CONSTRAINT fk_comment_reactions_comment
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE comment_reactions
          ADD CONSTRAINT fk_comment_reactions_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE comment_mutes
        ADD CONSTRAINT fk_comment_mutes_comment
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE comment_mutes
          ADD CONSTRAINT fk_comment_mutes_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE comment_reports
        ADD CONSTRAINT fk_comment_reports_comment
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // Indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_post_parent
      ON comments (post_id, parent_id, "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_parent_id
      ON comments (parent_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_user_id
      ON comments (user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_post_pinned
      ON comments (post_id, is_pinned DESC, "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_type
      ON comment_reactions (comment_id, reaction_type)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS comment_reports`);
    await queryRunner.query(`DROP TABLE IF EXISTS comment_mutes`);
    await queryRunner.query(`DROP TABLE IF EXISTS comment_reactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS comments`);
  }
}

