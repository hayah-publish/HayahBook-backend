import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContainVideoToPosts1763600000000 implements MigrationInterface {
  name = 'AddContainVideoToPosts1763600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('posts')) {
      const hasColumn = await queryRunner.hasColumn('posts', 'contain_video');
      if (!hasColumn) {
        await queryRunner.query(`
          ALTER TABLE posts
          ADD COLUMN contain_video BOOLEAN NOT NULL DEFAULT FALSE
        `);
      }

      // Backfill contain_video for legacy posts having a video_url
      await queryRunner.query(`
        UPDATE posts
        SET contain_video = TRUE
        WHERE video_url IS NOT NULL AND TRIM(video_url) != ''
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_contain_video
        ON posts (contain_video)
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('posts')) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS idx_posts_contain_video
      `);

      const hasColumn = await queryRunner.hasColumn('posts', 'contain_video');
      if (hasColumn) {
        await queryRunner.query(`
          ALTER TABLE posts
          DROP COLUMN contain_video
        `);
      }
    }
  }
}
