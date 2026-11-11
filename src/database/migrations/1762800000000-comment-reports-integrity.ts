import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentReportsIntegrity1762800000000 implements MigrationInterface {
  name = 'CommentReportsIntegrity1762800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('comment_reports'))) return;

    await queryRunner.query(`
      DELETE FROM comment_reports report
      USING (
        SELECT id FROM (
          SELECT id, row_number() OVER (
            PARTITION BY comment_id, user_id ORDER BY "createdAt" ASC, id ASC
          ) AS duplicate_number
          FROM comment_reports
        ) ranked
        WHERE duplicate_number > 1
      ) duplicates
      WHERE report.id = duplicates.id
    `);

    await queryRunner.query(`
      DELETE FROM comment_reports report
      WHERE NOT EXISTS (SELECT 1 FROM comments c WHERE c.id = report.comment_id)
         OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = report.user_id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_comment_reports_comment_user
      ON comment_reports (comment_id, user_id)
    `);

    if (await queryRunner.hasTable('users')) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE comment_reports
          ADD CONSTRAINT fk_comment_reports_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS comment_reports DROP CONSTRAINT IF EXISTS fk_comment_reports_user`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_comment_reports_comment_user`,
    );
  }
}
