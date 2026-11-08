import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSecurityTables1762300000000 implements MigrationInterface {
  name = 'AuthSecurityTables1762300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        purpose varchar(32) NOT NULL,
        token_hash char(64) NOT NULL UNIQUE,
        token_version integer NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        consumed_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE auth_sessions
          ADD CONSTRAINT fk_auth_sessions_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_purpose_expiry
      ON auth_sessions (user_id, purpose, expires_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
      ON auth_sessions (expires_at)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        key varchar(96) PRIMARY KEY,
        hits integer NOT NULL,
        window_ends_at timestamptz NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expiry
      ON auth_rate_limits (window_ends_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS auth_rate_limits');
    await queryRunner.query('DROP TABLE IF EXISTS auth_sessions');
  }
}
