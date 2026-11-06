import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { EventRole, GlobalRole, Membership } from '../server/permissions.js';

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  cpf: string | null;
  passwordHash: string;
  role: GlobalRole;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  cpf: string | null;
  password_hash: string;
  role: string;
};

@Injectable()
export class UsersRepository implements OnModuleDestroy {
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

  async findByEmail(email: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, name, email, cpf, password_hash, role
       FROM users
       WHERE email = $1`,
      [email],
    );
    const row = result.rows[0];
    if (!row || (row.role !== 'ADMIN' && row.role !== 'USER')) return null;
    return mapUser(row);
  }

  async findByCpf(cpf: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, name, email, cpf, password_hash, role
       FROM users
       WHERE cpf = $1`,
      [cpf],
    );
    const row = result.rows[0];
    if (!row || (row.role !== 'ADMIN' && row.role !== 'USER')) return null;
    return mapUser(row);
  }

  async findAdmin(): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, name, email, cpf, password_hash, role
       FROM users
       WHERE role = 'ADMIN'
       ORDER BY created_at
       LIMIT 1`,
    );
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, name, email, cpf, password_hash, role
       FROM users
       WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row || (row.role !== 'ADMIN' && row.role !== 'USER')) return null;
    return mapUser(row);
  }

  async create(input: {
    name: string;
    email: string;
    cpf: string;
    passwordHash: string;
  }): Promise<StoredUser> {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (id, name, email, cpf, password_hash, role, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'USER', NOW())
       RETURNING id, name, email, cpf, password_hash, role`,
      [input.name, input.email, input.cpf, input.passwordHash],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Não foi possível criar a conta.');
    return mapUser(row);
  }

  async linkByCpf(userId: string, cpf: string): Promise<void> {
    await this.pool.query(
      `UPDATE robotics_team_members
       SET user_id = $1
       WHERE cpf = $2 AND user_id IS NULL AND released_at IS NULL`,
      [userId, cpf],
    );
  }

  async memberships(userId: string): Promise<Membership[]> {
    const result = await this.pool.query<{ event_id: string; role: string }>(
      `SELECT event_id, role FROM event_members WHERE user_id = $1`,
      [userId],
    );
    return result.rows.flatMap((row) => {
      if (!isEventRole(row.role)) return [];
      return [{ eventId: row.event_id, role: row.role }];
    });
  }

  async deleteByEmail(email: string): Promise<void> {
    await this.pool.query(`DELETE FROM users WHERE email = $1`, [email]);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

function mapUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    cpf: row.cpf,
    passwordHash: row.password_hash,
    role: row.role as GlobalRole,
  };
}

function isEventRole(value: string): value is EventRole {
  return (
    value === 'ORGANIZER' ||
    value === 'STAFF' ||
    value === 'MONITOR' ||
    value === 'JUDGE'
  );
}
