import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAnonymousNumber1763100000000 implements MigrationInterface {
  name = 'UserAnonymousNumber1763100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) {
      // 1. Add anonymous_number column
      await queryRunner.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS anonymous_number INT NULL
      `);

      // 2. Add unique index
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_anonymous_number
        ON users (anonymous_number)
      `);

      // 3. Backfill all existing users with unique random 5-digit number (10000..99999)
      // If 99999 is reached or exhausted, increment by 1
      await queryRunner.query(`
        DO $$
        DECLARE
          u RECORD;
          cand INT;
          taken BOOLEAN;
          max_val INT;
        BEGIN
          FOR u IN SELECT id FROM users WHERE anonymous_number IS NULL ORDER BY "createdAt" ASC, id ASC LOOP
            taken := TRUE;
            FOR i IN 1..10 LOOP
              cand := floor(random() * (99999 - 10000 + 1) + 10000)::INT;
              SELECT EXISTS(SELECT 1 FROM users WHERE anonymous_number = cand) INTO taken;
              IF NOT taken THEN
                EXIT;
              END IF;
            END LOOP;

            IF taken THEN
              SELECT COALESCE(MAX(anonymous_number), 99999) INTO max_val FROM users;
              cand := GREATEST(max_val, 99999) + 1;
            END IF;

            UPDATE users SET anonymous_number = cand WHERE id = u.id;
          END LOOP;
        END $$;
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS uq_users_anonymous_number
      `);
      await queryRunner.query(`
        ALTER TABLE users
        DROP COLUMN IF EXISTS anonymous_number
      `);
    }
  }
}
