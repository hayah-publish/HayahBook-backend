import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddViewsAndPagesCount1764000000000 implements MigrationInterface {
  name = 'AddViewsAndPagesCount1764000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('posts')) {
      const hasViewsCount = await queryRunner.hasColumn('posts', 'views_count');
      if (!hasViewsCount) {
        await queryRunner.query(`
          ALTER TABLE posts
          ADD COLUMN views_count integer NOT NULL DEFAULT 0
        `);
      }
    }

    if (await queryRunner.hasTable('books')) {
      const hasPagesCount = await queryRunner.hasColumn('books', 'pages_count');
      if (!hasPagesCount) {
        await queryRunner.query(`
          ALTER TABLE books
          ADD COLUMN pages_count integer DEFAULT 500
        `);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('posts')) {
      const hasViewsCount = await queryRunner.hasColumn('posts', 'views_count');
      if (hasViewsCount) {
        await queryRunner.query(`
          ALTER TABLE posts
          DROP COLUMN views_count
        `);
      }
    }

    if (await queryRunner.hasTable('books')) {
      const hasPagesCount = await queryRunner.hasColumn('books', 'pages_count');
      if (hasPagesCount) {
        await queryRunner.query(`
          ALTER TABLE books
          DROP COLUMN pages_count
        `);
      }
    }
  }
}
