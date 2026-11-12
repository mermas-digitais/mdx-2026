import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

export type SlotStatus = 'CONFIRMED' | 'WAITLIST' | 'CANCELLED';

export type ModalityVacancy = {
  id: string;
  name: string;
  slotLimit: number;
  confirmed: number;
  waitlist: number;
};

export type RoboticsMemberView = {
  id: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  linked: boolean;
  accountName: string | null;
  accountEmail: string | null;
  accountPhone: string | null;
  accountInstitution: string | null;
  releasedAt: string | null;
};

export type RoboticsSlotView = {
  modalityId: string;
  name: string;
  status: SlotStatus;
};

export type RoboticsTeamView = {
  id: string;
  eventId: string;
  name: string;
  institution: string;
  advisorUserId: string;
  advisorName: string;
  advisorEmail: string;
  advisorPhone: string;
  advisorCpf: string;
  withdrawnAt: string | null;
  createdAt: string;
  members: RoboticsMemberView[];
  modalities: RoboticsSlotView[];
};

export type CreateRoboticsTeam = {
  eventId: string;
  advisorUserId: string;
  name: string;
  institution: string;
  advisorName: string;
  advisorEmail: string;
  advisorPhone: string;
  advisorDocument: string;
  members: {
    fullName: string;
    cpf: string;
    birthDate: string;
    document: string;
  }[];
  modalityIds: string[];
};

export class RoboticsRejected extends Error {
  constructor(readonly fields: Record<string, string>) {
    super('Revise os campos.');
  }
}

type TeamRow = {
  id: string;
  event_id: string;
  name: string;
  institution: string;
  advisor_user_id: string;
  advisor_name: string;
  advisor_email: string;
  advisor_phone: string;
  advisor_cpf: string | null;
  withdrawn_at: Date | null;
  created_at: Date;
};

type MemberRow = {
  id: string;
  team_id: string;
  full_name: string;
  cpf: string;
  birth_date: Date | string;
  user_id: string | null;
  account_name: string | null;
  account_email: string | null;
  account_phone: string | null;
  account_institution: string | null;
  released_at: Date | null;
};

type SlotRow = {
  team_id: string;
  modality_id: string;
  name: string;
  status: string;
};

@Injectable()
export class RoboticsRepository implements OnModuleDestroy {
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
    pg.types.setTypeParser(1082, (value: string) => value);
  }

  async vacancies(eventId: string): Promise<ModalityVacancy[]> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      slot_limit: number;
      confirmed: number;
      waitlist: number;
    }>(
      `SELECT modality.id, modality.name, modality.slot_limit,
              count(*) FILTER (WHERE entry.status = 'CONFIRMED' AND team.withdrawn_at IS NULL)::int AS confirmed,
              count(*) FILTER (WHERE entry.status = 'WAITLIST' AND team.withdrawn_at IS NULL)::int AS waitlist
       FROM robotics_modalities modality
       LEFT JOIN robotics_team_modalities entry ON entry.modality_id = modality.id
       LEFT JOIN robotics_teams team ON team.id = entry.team_id
       WHERE modality.event_id = $1
       GROUP BY modality.id
       ORDER BY modality.display_order`,
      [eventId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slotLimit: row.slot_limit,
      confirmed: row.confirmed,
      waitlist: row.waitlist,
    }));
  }

  async cpfOf(userId: string): Promise<string | null> {
    const result = await this.pool.query<{ cpf: string | null }>(
      `SELECT cpf FROM users WHERE id = $1`,
      [userId],
    );
    return result.rows[0]?.cpf ?? null;
  }

  async assignCpf(userId: string, cpf: string): Promise<'saved' | 'same' | 'mismatch' | 'taken'> {
    const current = await this.cpfOf(userId);
    if (current === cpf) {
      await this.linkCpf(userId, cpf);
      return 'same';
    }
    if (current) return 'mismatch';
    try {
      await this.pool.query(`UPDATE users SET cpf = $2, updated_at = NOW() WHERE id = $1`, [
        userId,
        cpf,
      ]);
    } catch (error) {
      if (constraintOf(error) === 'users_cpf_key') return 'taken';
      throw error;
    }
    await this.linkCpf(userId, cpf);
    return 'saved';
  }

  async linkCpf(userId: string, cpf: string): Promise<void> {
    await this.pool.query(
      `UPDATE robotics_team_members
       SET user_id = $1
       WHERE cpf = $2 AND user_id IS NULL AND released_at IS NULL`,
      [userId, cpf],
    );
  }

  async createTeam(input: CreateRoboticsTeam): Promise<RoboticsTeamView> {
    const client = await this.pool.connect();
    let committed = false;
    try {
      await client.query('BEGIN');
      const locked = await client.query<{ id: string; name: string; slot_limit: number }>(
        `SELECT id, name, slot_limit
         FROM robotics_modalities
         WHERE event_id = $1 AND id = ANY($2::uuid[])
         FOR UPDATE`,
        [input.eventId, input.modalityIds],
      );
      if (locked.rows.length !== new Set(input.modalityIds).size) {
        throw new RoboticsRejected({ modalityIds: 'Escolha modalidades deste evento.' });
      }

      const nameTaken = await client.query(
        `SELECT 1 FROM robotics_teams
         WHERE event_id = $1 AND withdrawn_at IS NULL AND lower(name) = lower($2)`,
        [input.eventId, input.name],
      );
      if ((nameTaken.rowCount ?? 0) > 0) {
        throw new RoboticsRejected({ teamName: 'Já existe uma equipe com esse nome.' });
      }

      for (const [index, member] of input.members.entries()) {
        const taken = await client.query(
          `SELECT 1 FROM robotics_team_members
           WHERE event_id = $1 AND cpf = $2 AND released_at IS NULL`,
          [input.eventId, member.cpf],
        );
        if ((taken.rowCount ?? 0) > 0) {
          throw new RoboticsRejected({
            [`members.${index}.cpf`]: 'Este CPF já está em uma equipe deste evento.',
          });
        }
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO robotics_teams (
           id, event_id, advisor_user_id, name, institution,
           advisor_name, advisor_email, advisor_phone, advisor_document,
           rules_accepted_at, updated_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
         ) RETURNING id`,
        [
          input.eventId,
          input.advisorUserId,
          input.name,
          input.institution,
          input.advisorName,
          input.advisorEmail,
          input.advisorPhone,
          input.advisorDocument,
        ],
      );
      const teamId = inserted.rows[0]?.id;
      if (!teamId) throw new Error('Não foi possível criar a equipe.');

      const linked = await client.query<{ id: string; cpf: string }>(
        `SELECT id, cpf FROM users WHERE cpf = ANY($1::text[])`,
        [input.members.map((member) => member.cpf)],
      );
      const userByCpf = new Map(linked.rows.map((row) => [row.cpf, row.id]));

      for (const member of input.members) {
        await client.query(
          `INSERT INTO robotics_team_members (
             id, team_id, event_id, full_name, cpf, birth_date, document, user_id
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5::date, $6, $7
           )`,
          [
            teamId,
            input.eventId,
            member.fullName,
            member.cpf,
            member.birthDate,
            member.document,
            userByCpf.get(member.cpf) ?? null,
          ],
        );
      }

      for (const modality of locked.rows) {
        const count = await client.query<{ total: number }>(
          `SELECT count(*)::int AS total
           FROM robotics_team_modalities entry
           JOIN robotics_teams team ON team.id = entry.team_id
           WHERE entry.modality_id = $1
             AND entry.status = 'CONFIRMED'
             AND team.withdrawn_at IS NULL`,
          [modality.id],
        );
        const status = (count.rows[0]?.total ?? 0) < modality.slot_limit ? 'CONFIRMED' : 'WAITLIST';
        await client.query(
          `INSERT INTO robotics_team_modalities (
             id, team_id, modality_id, status, updated_at
           ) VALUES (gen_random_uuid(), $1, $2, $3::"RoboticsSlotStatus", NOW())`,
          [teamId, modality.id, status],
        );
      }

      await client.query('COMMIT');
      committed = true;
      const created = await this.teamById(teamId);
      if (!created) throw new Error('Não foi possível criar a equipe.');
      return created;
    } catch (error) {
      if (!committed) await client.query('ROLLBACK');
      const constraint = constraintOf(error);
      if (constraint === 'robotics_teams_event_name_active') {
        throw new RoboticsRejected({ teamName: 'Já existe uma equipe com esse nome.' });
      }
      if (constraint === 'robotics_team_members_event_cpf_active') {
        throw new RoboticsRejected({ members: 'Uma integrante já está em outra equipe.' });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateTeam(input: {
    eventId: string;
    teamId: string;
    advisorUserId: string;
    name: string;
    institution: string;
    advisorName: string;
    advisorPhone: string;
    advisorCpf: string;
    members: { id: string; fullName: string; cpf: string; birthDate: string }[];
  }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const team = await client.query<{ id: string }>(
        `SELECT id FROM robotics_teams
         WHERE id = $1 AND event_id = $2 AND advisor_user_id = $3 AND withdrawn_at IS NULL
         FOR UPDATE`,
        [input.teamId, input.eventId, input.advisorUserId],
      );
      if (!team.rows[0]) {
        await client.query('ROLLBACK');
        return false;
      }

      const nameTaken = await client.query(
        `SELECT 1 FROM robotics_teams
         WHERE event_id = $1 AND withdrawn_at IS NULL AND lower(name) = lower($2) AND id <> $3`,
        [input.eventId, input.name, input.teamId],
      );
      if ((nameTaken.rowCount ?? 0) > 0) {
        throw new RoboticsRejected({ teamName: 'Já existe uma equipe com esse nome.' });
      }

      const active = await client.query<{ id: string }>(
        `SELECT id FROM robotics_team_members
         WHERE team_id = $1 AND released_at IS NULL
         FOR UPDATE`,
        [input.teamId],
      );
      const activeIds = new Set(active.rows.map((row) => row.id));
      const sameMembers =
        input.members.length === activeIds.size &&
        input.members.every((member) => activeIds.has(member.id));
      if (!sameMembers) {
        throw new RoboticsRejected({ members: 'A lista de integrantes mudou. Atualize a página.' });
      }

      const memberIds = input.members.map((member) => member.id);
      for (const member of input.members) {
        const taken = await client.query(
          `SELECT 1 FROM robotics_team_members
           WHERE event_id = $1 AND cpf = $2 AND released_at IS NULL AND NOT (id = ANY($3::uuid[]))`,
          [input.eventId, member.cpf, memberIds],
        );
        if ((taken.rowCount ?? 0) > 0) {
          throw new RoboticsRejected({
            [`members.${input.members.indexOf(member)}.cpf`]: 'Este CPF já está em uma equipe deste evento.',
          });
        }
      }

      try {
        await client.query(
          `UPDATE users SET name = $2, cpf = $3, updated_at = NOW() WHERE id = $1`,
          [input.advisorUserId, input.advisorName, input.advisorCpf],
        );
      } catch (error) {
        if (constraintOf(error) === 'users_cpf_key') {
          throw new RoboticsRejected({ advisorCpf: 'Já existe uma conta com esse CPF.' });
        }
        throw error;
      }

      await client.query(
        `UPDATE robotics_teams
         SET name = $2, institution = $3, advisor_name = $4, advisor_phone = $5, updated_at = NOW()
         WHERE id = $1`,
        [input.teamId, input.name, input.institution, input.advisorName, input.advisorPhone],
      );

      for (const member of input.members) {
        await client.query(
          `UPDATE robotics_team_members
           SET full_name = $3,
               cpf = $4::varchar,
               birth_date = $5::date,
               user_id = (SELECT id FROM users WHERE cpf = $4::varchar)
           WHERE id = $1 AND team_id = $2 AND released_at IS NULL`,
          [member.id, input.teamId, member.fullName, member.cpf, member.birthDate],
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async releaseMember(
    eventId: string,
    teamId: string,
    memberId: string,
    advisorUserId: string,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const team = await client.query<{ id: string }>(
        `SELECT id FROM robotics_teams
         WHERE id = $1 AND event_id = $2 AND advisor_user_id = $3 AND withdrawn_at IS NULL
         FOR UPDATE`,
        [teamId, eventId, advisorUserId],
      );
      if (!team.rows[0]) {
        await client.query('ROLLBACK');
        return false;
      }

      const active = await client.query<{ id: string }>(
        `SELECT id FROM robotics_team_members
         WHERE team_id = $1 AND released_at IS NULL
         FOR UPDATE`,
        [teamId],
      );
      if (active.rows.length <= 3) {
        throw new RoboticsRejected({
          members: 'A equipe precisa ficar com pelo menos 3 integrantes.',
        });
      }

      const updated = await client.query(
        `UPDATE robotics_team_members
         SET released_at = NOW()
         WHERE id = $1 AND team_id = $2 AND released_at IS NULL`,
        [memberId, teamId],
      );
      if ((updated.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async withdraw(eventId: string, teamId: string, advisorUserId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const team = await client.query<{ id: string }>(
        `SELECT id FROM robotics_teams
         WHERE id = $1 AND event_id = $2 AND advisor_user_id = $3 AND withdrawn_at IS NULL
         FOR UPDATE`,
        [teamId, eventId, advisorUserId],
      );
      if (!team.rows[0]) {
        await client.query('ROLLBACK');
        return false;
      }

      const confirmed = await client.query<{ modality_id: string }>(
        `SELECT modality_id FROM robotics_team_modalities
         WHERE team_id = $1 AND status = 'CONFIRMED'
         FOR UPDATE`,
        [teamId],
      );
      if (confirmed.rows.length > 0) {
        await client.query(
          `SELECT id FROM robotics_modalities WHERE id = ANY($1::uuid[]) FOR UPDATE`,
          [confirmed.rows.map((row) => row.modality_id)],
        );
      }

      await client.query(
        `UPDATE robotics_team_modalities
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE team_id = $1 AND status <> 'CANCELLED'`,
        [teamId],
      );
      await client.query(
        `UPDATE robotics_team_members
         SET released_at = NOW()
         WHERE team_id = $1 AND released_at IS NULL`,
        [teamId],
      );
      await client.query(
        `UPDATE robotics_teams SET withdrawn_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [teamId],
      );

      for (const row of confirmed.rows) {
        await client.query(
          `UPDATE robotics_team_modalities
           SET status = 'CONFIRMED', updated_at = NOW()
           WHERE id = (
             SELECT entry.id
             FROM robotics_team_modalities entry
             JOIN robotics_teams team ON team.id = entry.team_id
             WHERE entry.modality_id = $1
               AND entry.status = 'WAITLIST'
               AND team.withdrawn_at IS NULL
             ORDER BY entry.created_at, entry.id
             LIMIT 1
           )`,
          [row.modality_id],
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async teamsForAdvisor(eventId: string, advisorUserId: string): Promise<RoboticsTeamView[]> {
    return this.collect(
      `SELECT team.id, team.event_id, team.name, team.institution, team.advisor_user_id,
              team.advisor_name, team.advisor_email, team.advisor_phone, advisor.cpf AS advisor_cpf,
              team.withdrawn_at, team.created_at
       FROM robotics_teams team
       LEFT JOIN users advisor ON advisor.id = team.advisor_user_id
       WHERE team.event_id = $1 AND team.advisor_user_id = $2
       ORDER BY team.created_at DESC`,
      [eventId, advisorUserId],
    );
  }

  async teamsForEvent(eventId: string): Promise<RoboticsTeamView[]> {
    return this.collect(
      `SELECT team.id, team.event_id, team.name, team.institution, team.advisor_user_id,
              team.advisor_name, team.advisor_email, team.advisor_phone, advisor.cpf AS advisor_cpf,
              team.withdrawn_at, team.created_at
       FROM robotics_teams team
       LEFT JOIN users advisor ON advisor.id = team.advisor_user_id
       WHERE team.event_id = $1
       ORDER BY team.created_at`,
      [eventId],
      true,
    );
  }

  async teamById(teamId: string): Promise<RoboticsTeamView | null> {
    const teams = await this.collect(
      `SELECT team.id, team.event_id, team.name, team.institution, team.advisor_user_id,
              team.advisor_name, team.advisor_email, team.advisor_phone, advisor.cpf AS advisor_cpf,
              team.withdrawn_at, team.created_at
       FROM robotics_teams team
       LEFT JOIN users advisor ON advisor.id = team.advisor_user_id
       WHERE team.id = $1`,
      [teamId],
    );
    return teams[0] ?? null;
  }

  async documentOf(
    teamId: string,
    documentId: string,
  ): Promise<{ eventId: string; advisorUserId: string; stored: string } | null> {
    if (documentId === 'advisor') {
      const result = await this.pool.query<{
        event_id: string;
        advisor_user_id: string;
        advisor_document: string;
      }>(
        `SELECT event_id, advisor_user_id, advisor_document
         FROM robotics_teams WHERE id = $1`,
        [teamId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        eventId: row.event_id,
        advisorUserId: row.advisor_user_id,
        stored: row.advisor_document,
      };
    }
    const result = await this.pool.query<{
      event_id: string;
      advisor_user_id: string;
      document: string;
    }>(
      `SELECT team.event_id, team.advisor_user_id, member.document
       FROM robotics_team_members member
       JOIN robotics_teams team ON team.id = member.team_id
       WHERE member.id = $1 AND member.team_id = $2`,
      [documentId, teamId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      eventId: row.event_id,
      advisorUserId: row.advisor_user_id,
      stored: row.document,
    };
  }

  async adminUpdateTeam(input: {
    eventId: string;
    teamId: string;
    name: string;
    institution: string;
    advisorName: string;
    advisorEmail: string;
    advisorPhone: string;
    advisorCpf: string;
    members: { id: string; fullName: string; cpf: string; birthDate: string }[];
  }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const team = await client.query<{ id: string; advisor_user_id: string }>(
        `SELECT id, advisor_user_id FROM robotics_teams
         WHERE id = $1 AND event_id = $2
         FOR UPDATE`,
        [input.teamId, input.eventId],
      );
      const row = team.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return false;
      }

      const nameTaken = await client.query(
        `SELECT 1 FROM robotics_teams
         WHERE event_id = $1 AND withdrawn_at IS NULL AND lower(name) = lower($2) AND id <> $3`,
        [input.eventId, input.name, input.teamId],
      );
      if ((nameTaken.rowCount ?? 0) > 0) {
        throw new RoboticsRejected({ teamName: 'Já existe uma equipe com esse nome.' });
      }

      const active = await client.query<{ id: string }>(
        `SELECT id FROM robotics_team_members
         WHERE team_id = $1 AND released_at IS NULL
         FOR UPDATE`,
        [input.teamId],
      );
      const activeIds = new Set(active.rows.map((item) => item.id));
      const sameMembers =
        input.members.length === activeIds.size &&
        input.members.every((member) => activeIds.has(member.id));
      if (!sameMembers) {
        throw new RoboticsRejected({ members: 'A lista de integrantes mudou. Atualize a página.' });
      }

      const memberIds = input.members.map((member) => member.id);
      for (const [index, member] of input.members.entries()) {
        const taken = await client.query(
          `SELECT 1 FROM robotics_team_members
           WHERE event_id = $1 AND cpf = $2 AND released_at IS NULL AND NOT (id = ANY($3::uuid[]))`,
          [input.eventId, member.cpf, memberIds],
        );
        if ((taken.rowCount ?? 0) > 0) {
          throw new RoboticsRejected({
            [`members.${index}.cpf`]: 'Este CPF já está em uma equipe deste evento.',
          });
        }
      }

      try {
        await client.query(
          `UPDATE users SET name = $2, email = $3, cpf = $4, updated_at = NOW() WHERE id = $1`,
          [row.advisor_user_id, input.advisorName, input.advisorEmail, input.advisorCpf],
        );
      } catch (error) {
        const constraint = constraintOf(error);
        if (constraint === 'users_cpf_key') {
          throw new RoboticsRejected({ advisorCpf: 'Já existe uma conta com esse CPF.' });
        }
        if (constraint === 'users_email_key') {
          throw new RoboticsRejected({ advisorEmail: 'Já existe uma conta com esse e-mail.' });
        }
        throw error;
      }

      await client.query(
        `UPDATE robotics_teams
         SET name = $2, institution = $3, advisor_name = $4, advisor_email = $5,
             advisor_phone = $6, updated_at = NOW()
         WHERE id = $1`,
        [
          input.teamId,
          input.name,
          input.institution,
          input.advisorName,
          input.advisorEmail,
          input.advisorPhone,
        ],
      );

      for (const member of input.members) {
        await client.query(
          `UPDATE robotics_team_members
           SET full_name = $3,
               cpf = $4::varchar,
               birth_date = $5::date,
               user_id = (SELECT id FROM users WHERE cpf = $4::varchar)
           WHERE id = $1 AND team_id = $2 AND released_at IS NULL`,
          [member.id, input.teamId, member.fullName, member.cpf, member.birthDate],
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async adminReleaseMember(eventId: string, teamId: string, memberId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE robotics_team_members
       SET released_at = NOW()
       WHERE id = $1 AND team_id = $2 AND event_id = $3 AND released_at IS NULL`,
      [memberId, teamId, eventId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async adminDeleteTeam(eventId: string, teamId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const team = await client.query<{ id: string }>(
        `SELECT id FROM robotics_teams WHERE id = $1 AND event_id = $2 FOR UPDATE`,
        [teamId, eventId],
      );
      if (!team.rows[0]) {
        await client.query('ROLLBACK');
        return false;
      }

      const confirmed = await client.query<{ modality_id: string }>(
        `SELECT modality_id FROM robotics_team_modalities
         WHERE team_id = $1 AND status = 'CONFIRMED'
         FOR UPDATE`,
        [teamId],
      );
      if (confirmed.rows.length > 0) {
        await client.query(
          `SELECT id FROM robotics_modalities WHERE id = ANY($1::uuid[]) FOR UPDATE`,
          [confirmed.rows.map((row) => row.modality_id)],
        );
      }
      for (const row of confirmed.rows) {
        await client.query(
          `UPDATE robotics_team_modalities
           SET status = 'CONFIRMED', updated_at = NOW()
           WHERE id = (
             SELECT entry.id
             FROM robotics_team_modalities entry
             JOIN robotics_teams team ON team.id = entry.team_id
             WHERE entry.modality_id = $1
               AND entry.status = 'WAITLIST'
               AND team.withdrawn_at IS NULL
               AND entry.team_id <> $2
             ORDER BY entry.created_at, entry.id
             LIMIT 1
           )`,
          [row.modality_id, teamId],
        );
      }

      await client.query(`DELETE FROM robotics_team_members WHERE team_id = $1`, [teamId]);
      await client.query(`DELETE FROM robotics_team_modalities WHERE team_id = $1`, [teamId]);
      await client.query(`DELETE FROM robotics_teams WHERE id = $1`, [teamId]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async collect(
    sql: string,
    params: unknown[],
    includeReleased = false,
  ): Promise<RoboticsTeamView[]> {
    const teams = await this.pool.query<TeamRow>(sql, params);
    if (teams.rows.length === 0) return [];
    const ids = teams.rows.map((row) => row.id);
    const [members, slots] = await Promise.all([
      this.pool.query<MemberRow>(
        `SELECT member.id, member.team_id, member.full_name, member.cpf, member.birth_date,
                member.user_id, member.released_at, account.name AS account_name,
                account.email AS account_email,
                registration.answers->>'phone' AS account_phone,
                NULLIF(registration.answers->>'institution', '') AS account_institution
         FROM robotics_team_members member
         LEFT JOIN users account ON account.id = member.user_id
         LEFT JOIN registrations registration
           ON registration.user_id = member.user_id
          AND registration.event_id = member.event_id
          AND registration.status = 'CONFIRMED'
         WHERE member.team_id = ANY($1::uuid[])
           AND ($2::boolean OR member.released_at IS NULL)
         ORDER BY member.released_at NULLS FIRST, member.created_at`,
        [ids, includeReleased],
      ),
      this.pool.query<SlotRow>(
        `SELECT entry.team_id, entry.modality_id, modality.name, entry.status
         FROM robotics_team_modalities entry
         JOIN robotics_modalities modality ON modality.id = entry.modality_id
         WHERE entry.team_id = ANY($1::uuid[])
         ORDER BY modality.display_order`,
        [ids],
      ),
    ]);
    return teams.rows.map((team) => ({
      id: team.id,
      eventId: team.event_id,
      name: team.name,
      institution: team.institution,
      advisorUserId: team.advisor_user_id,
      advisorName: team.advisor_name,
      advisorEmail: team.advisor_email,
      advisorPhone: team.advisor_phone,
      advisorCpf: team.advisor_cpf ?? "",
      withdrawnAt: team.withdrawn_at ? team.withdrawn_at.toISOString() : null,
      createdAt: team.created_at.toISOString(),
      members: members.rows
        .filter((member) => member.team_id === team.id)
        .map((member) => ({
          id: member.id,
          fullName: member.full_name,
          cpf: member.cpf,
          birthDate: dayOf(member.birth_date),
          linked: member.user_id !== null,
          accountName: member.account_name,
          accountEmail: member.account_email,
          accountPhone: member.account_phone,
          accountInstitution: member.account_institution,
          releasedAt: member.released_at ? new Date(member.released_at).toISOString() : null,
        })),
      modalities: slots.rows
        .filter((slot) => slot.team_id === team.id)
        .flatMap((slot) => {
          if (slot.status !== 'CONFIRMED' && slot.status !== 'WAITLIST' && slot.status !== 'CANCELLED') {
            return [];
          }
          return [{ modalityId: slot.modality_id, name: slot.name, status: slot.status }];
        }),
    }));
  }
}

function dayOf(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function constraintOf(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    typeof error.constraint === 'string'
  ) {
    return error.constraint;
  }
  return null;
}
