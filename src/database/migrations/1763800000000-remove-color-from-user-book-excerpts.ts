import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveColorFromUserBookExcerpts1763800000000 implements MigrationInterface {
  name = 'RemoveColorFromUserBookExcerpts1763800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_book_excerpts')) {
      const hasColumn = await queryRunner.hasColumn('user_book_excerpts', 'color');
      if (hasColumn) {
        await queryRunner.query(`
          ALTER TABLE user_book_excerpts
          DROP COLUMN color
        `);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_book_excerpts')) {
      const hasColumn = await queryRunner.hasColumn('user_book_excerpts', 'color');
      if (!hasColumn) {
        await queryRunner.query(`
          ALTER TABLE user_book_excerpts
          ADD COLUMN color varchar(30) NOT NULL DEFAULT '#FF7A00'
        `);
      }
    }
  }
}
