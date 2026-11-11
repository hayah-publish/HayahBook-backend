import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostContentFormat1763200000000 implements MigrationInterface {
  name = 'AddPostContentFormat1763200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('posts')) {
      await queryRunner.query(`
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS content_format VARCHAR(20) DEFAULT 'markdown'
      `);
      await queryRunner.query(`
        UPDATE posts
        SET content_format = CASE WHEN type = 'article' THEN 'markdown' ELSE 'plain' END
        WHERE content_format IS NULL
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('posts')) {
      await queryRunner.query(`
        ALTER TABLE posts
        DROP COLUMN IF EXISTS content_format
      `);
    }
  }
}

