import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserBookExcerptsTable1763700000000 implements MigrationInterface {
  name = 'CreateUserBookExcerptsTable1763700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_book_excerpts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        book_id uuid NOT NULL,
        content text NOT NULL,
        note text,
        chapter varchar(150),
        page_number integer,
        color varchar(30) NOT NULL DEFAULT '#FF7A00',
        cfi_range varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE user_book_excerpts
          ADD CONSTRAINT fk_user_book_excerpts_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.books') IS NOT NULL THEN
          ALTER TABLE user_book_excerpts
          ADD CONSTRAINT fk_user_book_excerpts_book
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_book_excerpts_user_book
      ON user_book_excerpts (user_id, book_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_book_excerpts_user_created
      ON user_book_excerpts (user_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_book_excerpts_book
      ON user_book_excerpts (book_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_book_excerpts_book`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_book_excerpts_user_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_book_excerpts_user_book`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_book_excerpts CASCADE`);
  }
}
