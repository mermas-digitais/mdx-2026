import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

export type ActiveLoginCode = {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
};

@Injectable()
export class LoginCodesRepository implements OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    this.pool = new pg.Pool({
      connectionString,
      max: 5,
      ssl: connectionString.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
    });
    this.pool.on('error', () => undefined);
  }

  async latest(email: string): Promise<ActiveLoginCode | null> {
    const result = await this.pool.query<{
      id: string;
      code_hash: string;
      expires_at: Date;
      attempts: number;
      created_at: Date;
    }>(
      `SELECT id, code_hash, expires_at, attempts, created_at
       FROM login_codes
       WHERE email = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      codeHash: row.code_hash,
      expiresAt: row.expires_at,
      attempts: row.attempts,
      createdAt: row.created_at,
    };
  }

  async issue(email: string, codeHash: string, expiresAt: Date): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE login_codes SET consumed_at = NOW() WHERE email = $1 AND consumed_at IS NULL`,
        [email],
      );
      await client.query(
        `INSERT INTO login_codes (id, email, code_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), email, codeHash, expiresAt],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async bumpAttempts(id: string): Promise<void> {
    await this.pool.query(`UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1`, [id]);
  }

  async consume(id: string): Promise<void> {
    await this.pool.query(`UPDATE login_codes SET consumed_at = NOW() WHERE id = $1`, [id]);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
