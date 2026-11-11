import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostActionsBlockReportsHidden1762900000000 implements MigrationInterface {
  name = 'PostActionsBlockReportsHidden1762900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. comments_disabled column on posts
    if (await queryRunner.hasTable('posts')) {
      await queryRunner.query(`
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS comments_disabled BOOLEAN NOT NULL DEFAULT false
      `);
    }

    // 2. user_blocks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        blocker_id UUID NOT NULL,
        blocked_id UUID NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_blocks_blocker_blocked
      ON user_blocks (blocker_id, blocked_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker
      ON user_blocks (blocker_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
      ON user_blocks (blocked_id)
    `);

    // 3. user_hidden_posts table (for "View less")
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_hidden_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        post_id UUID NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT fk_user_hidden_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_hidden_posts_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_hidden_posts_user_post
      ON user_hidden_posts (user_id, post_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_hidden_posts_user
      ON user_hidden_posts (user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_hidden_posts_post
      ON user_hidden_posts (post_id)
    `);

    // 4. post_reports table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS post_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL,
        user_id UUID NOT NULL,
        reason VARCHAR(100) NOT NULL,
        reason_id UUID NULL,
        details VARCHAR(160) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT fk_post_reports_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        CONSTRAINT fk_post_reports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_post_reports_post_user
      ON post_reports (user_id, post_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_post_reports_post
      ON post_reports (post_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_post_reports_user
      ON post_reports (user_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS post_reports CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_hidden_posts CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_blocks CASCADE`);
    if (await queryRunner.hasTable('posts')) {
      await queryRunner.query(`
        ALTER TABLE posts DROP COLUMN IF EXISTS comments_disabled
      `);
    }
  }
}

