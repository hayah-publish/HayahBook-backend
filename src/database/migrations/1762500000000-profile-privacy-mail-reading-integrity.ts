import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfilePrivacyMailReadingIntegrity1762500000000 implements MigrationInterface {
  name = 'ProfilePrivacyMailReadingIntegrity1762500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['users', 'authors', 'creators']) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF to_regclass('public.${table}') IS NOT NULL THEN
            ALTER TABLE ${table}
              ADD COLUMN IF NOT EXISTS show_email boolean NOT NULL DEFAULT false,
              ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT false,
              ADD COLUMN IF NOT EXISTS show_birthday boolean NOT NULL DEFAULT false;
          END IF;
        END $$
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_email_outbox (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient varchar(255), subject varchar(255),
        encrypted_payload text, iv char(24) NOT NULL, auth_tag char(32) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
        available_at timestamptz NOT NULL DEFAULT now(), lock_until timestamptz, sent_at timestamptz,
        last_error varchar(100), created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_auth_email_outbox_status_available ON auth_email_outbox(status, available_at)`);

    for (const [table, index, target] of [
      ['user_author_follows', 'uq_user_author_follows_pair', 'author_id'],
      ['user_creator_follows', 'uq_user_creator_follows_pair', 'creator_id'],
    ]) {
      if (!await queryRunner.hasTable(table)) continue;
      const duplicate = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM ${table} GROUP BY user_id, ${target} HAVING count(*) > 1
        ) AS found
      `);
      if (Array.isArray(duplicate) && duplicate[0]?.found) {
        throw new Error(`Duplicate ${table} rows exist; resolve them before applying follow integrity constraints. No records were changed.`);
      }
      await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${index} ON ${table}(user_id, ${target})`);
    }

    if (await queryRunner.hasTable('user_books')) {
      const duplicates = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM user_books WHERE book_id IS NOT NULL GROUP BY user_id, book_id HAVING count(*) > 1
        ) OR EXISTS (
          SELECT 1 FROM user_books WHERE audiobook_id IS NOT NULL GROUP BY user_id, audiobook_id HAVING count(*) > 1
        ) AS found
      `);
      if (Array.isArray(duplicates) && duplicates[0]?.found) {
        throw new Error('Duplicate user_books records exist; resolve them before applying unique reading-history constraints. No records were changed.');
      }
      await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_books_user_book ON user_books(user_id, book_id) WHERE book_id IS NOT NULL`);
      await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_books_user_audiobook ON user_books(user_id, audiobook_id) WHERE audiobook_id IS NOT NULL`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_user_books_user_book`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_user_books_user_audiobook`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_user_author_follows_pair`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_user_creator_follows_pair`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_email_outbox`);
    for (const table of ['users', 'authors', 'creators']) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF to_regclass('public.${table}') IS NOT NULL THEN
            ALTER TABLE ${table} DROP COLUMN IF EXISTS show_email, DROP COLUMN IF EXISTS show_phone, DROP COLUMN IF EXISTS show_birthday;
          END IF;
        END $$
      `);
    }
  }
}
