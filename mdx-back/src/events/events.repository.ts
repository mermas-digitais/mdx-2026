import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { ActivityType, EventStatus, TeamRole } from '../server/event-schema.js';
import type { FieldType, RegistrationCategory } from '../server/form-schema.js';

pg.types.setTypeParser(1114, (value: string) => new Date(`${value.replace(' ', 'T')}Z`));

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EVENT_COLUMNS = `
  e.id, e.slug, e.title, e.description, e.theme, e.place, e.address,
  e.starts_at, e.ends_at, e.banner, e.status, e.registrations_open,
  e.color_primary, e.color_secondary, e.color_accent,
  (SELECT count(*)::int FROM registrations r
    WHERE r.event_id = e.id AND r.status = 'CONFIRMED') AS registration_count,
  (SELECT count(*)::int FROM activities a WHERE a.event_id = e.id) AS activity_count
`;

const writable = {
  title: 'title',
  slug: 'slug',
  theme: 'theme',
  description: 'description',
  place: 'place',
  address: 'address',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  colorPrimary: 'color_primary',
  colorSecondary: 'color_secondary',
  colorAccent: 'color_accent',
  banner: 'banner',
  status: 'status',
} as const;

export type EventRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  theme: string;
  place: string;
  address: string;
  startsAt: string | null;
  endsAt: string | null;
  banner: string | null;
  status: EventStatus;
  registrationsOpen: boolean;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorAccent: string | null;
  registrationCount: number;
  activityCount: number;
};

export type ParticipantRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  heard: string;
  status: string;
  createdAt: string;
};

export type LocationRecord = {
  id: string;
  name: string;
  notes: string | null;
};

export type MemberRecord = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
};

export type ActivityRecord = {
  id: string;
  locationId: string | null;
  title: string;
  description: string;
  type: ActivityType;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  requiresEnrollment: boolean;
  grantsStamp: boolean;
  responsible: string;
  displayOrder: number;
};

export type AnnouncementRecord = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

export type RuleRecord = {
  id: string;
  title: string;
  rules: string;
};

export type FormFieldRecord = {
  id: string;
  label: string;
  help: string;
  type: FieldType;
  required: boolean;
  options: string[];
  categories: RegistrationCategory[];
  displayOrder: number;
};

export type FormFieldWrite = {
  label: string;
  help: string;
  type: FieldType;
  required: boolean;
  options: string[];
  categories: RegistrationCategory[];
};

export type ActivityWrite = {
  locationId: string | null;
  title: string;
  description: string;
  type: ActivityType;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  requiresEnrollment: boolean;
  grantsStamp: boolean;
  responsible: string;
};

type EventSql = {
  id: string;
  slug: string;
  title: string;
  description: string;
  theme: string;
  place: string;
  address: string;
  starts_at: Date | null;
  ends_at: Date | null;
  banner: string | null;
  status: string;
  registrations_open: boolean;
  color_primary: string | null;
  color_secondary: string | null;
  color_accent: string | null;
  registration_count: number;
  activity_count: number;
};

export type EventPatch = Partial<{
  title: string;
  slug: string;
  theme: string;
  description: string;
  place: string;
  address: string;
  startsAt: string | null;
  endsAt: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorAccent: string | null;
  banner: string | null;
  status: EventStatus;
}>;

@Injectable()
export class EventsRepository implements OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    this.pool = new pg.Pool({
      connectionString,
      max: 5,
      options: '-c timezone=UTC',
      ssl: connectionString.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
    });
    this.pool.on('error', () => undefined);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async list(eventIds: string[] | null): Promise<EventRecord[]> {
    if (eventIds && eventIds.length === 0) return [];
    const ids = eventIds?.filter((id) => UUID.test(id)) ?? null;
    if (eventIds && ids?.length === 0) return [];
    const result = await this.pool.query<EventSql>(
      ids
        ? `SELECT ${EVENT_COLUMNS} FROM events e
           WHERE e.id = ANY($1::uuid[])
           ORDER BY e.starts_at DESC NULLS FIRST, e.created_at DESC`
        : `SELECT ${EVENT_COLUMNS} FROM events e
           ORDER BY e.starts_at DESC NULLS FIRST, e.created_at DESC`,
      ids ? [ids] : [],
    );
    return result.rows.map(mapEvent);
  }

  async findById(id: string): Promise<EventRecord | null> {
    if (!UUID.test(id)) return null;
    const result = await this.pool.query<EventSql>(
      `SELECT ${EVENT_COLUMNS} FROM events e WHERE e.id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapEvent(row) : null;
  }

  async findByIdOrSlug(value: string): Promise<EventRecord | null> {
    if (UUID.test(value)) {
      const byId = await this.findById(value);
      if (byId) return byId;
    }
    return this.findBySlug(value);
  }

  async findBySlug(slug: string): Promise<EventRecord | null> {
    const result = await this.pool.query<EventSql>(
      `SELECT ${EVENT_COLUMNS} FROM events e WHERE e.slug = $1`,
      [slug],
    );
    const row = result.rows[0];
    return row ? mapEvent(row) : null;
  }

  async findPublicBySlug(slug: string): Promise<EventRecord | null> {
    const result = await this.pool.query<EventSql>(
      `SELECT ${EVENT_COLUMNS} FROM events e
       WHERE e.slug = $1 AND e.status IN ('PUBLISHED', 'CLOSED')`,
      [slug],
    );
    const row = result.rows[0];
    return row ? mapEvent(row) : null;
  }

  async slugOwner(slug: string): Promise<string | null> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM events WHERE slug = $1`,
      [slug],
    );
    return result.rows[0]?.id ?? null;
  }

  async create(input: {
    title: string;
    slug: string;
    theme: string;
    description: string;
    place: string;
    address: string;
    startsAt: string | null;
    endsAt: string | null;
    colorPrimary: string | null;
    colorSecondary: string | null;
    colorAccent: string | null;
  }): Promise<EventRecord> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO events (
         id, slug, title, description, theme, place, address,
         starts_at, ends_at, status, color_primary, color_secondary, color_accent,
         updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', $9, $10, $11, NOW()
       ) RETURNING id`,
      [
        input.slug,
        input.title,
        input.description,
        input.theme,
        input.place,
        input.address,
        input.startsAt,
        input.endsAt,
        input.colorPrimary,
        input.colorSecondary,
        input.colorAccent,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('Não foi possível criar o evento.');
    const created = await this.findById(id);
    if (!created) throw new Error('Não foi possível criar o evento.');
    return created;
  }

  async update(id: string, patch: EventPatch): Promise<EventRecord | null> {
    const entries = Object.entries(patch).filter((entry) => entry[1] !== undefined);
    if (entries.length === 0) return this.findById(id);
    const sets: string[] = [];
    const values: unknown[] = [id];
    for (const [key, value] of entries) {
      const column = writable[key as keyof typeof writable];
      if (!column) continue;
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
    if (sets.length === 0) return this.findById(id);
    await this.pool.query(
      `UPDATE events SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`,
      values,
    );
    return this.findById(id);
  }

  async duplicate(
    source: EventRecord,
    slug: string,
    organizerUserId: string | null,
  ): Promise<EventRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO events (
           id, slug, title, description, theme, place, address,
           starts_at, ends_at, banner, status,
           color_primary, color_secondary, color_accent, updated_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT',
           $10, $11, $12, NOW()
         ) RETURNING id`,
        [
          slug,
          source.title,
          source.description,
          source.theme,
          source.place,
          source.address,
          source.startsAt,
          source.endsAt,
          source.banner,
          source.colorPrimary,
          source.colorSecondary,
          source.colorAccent,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new Error('Não foi possível duplicar o evento.');

      const locations = await client.query<{ id: string; name: string; notes: string | null }>(
        `INSERT INTO locations (id, event_id, name, notes, updated_at)
         SELECT gen_random_uuid(), $1, name, notes, NOW()
         FROM locations WHERE event_id = $2
         RETURNING id, name, notes`,
        [id, source.id],
      );
      const previous = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM locations WHERE event_id = $1`,
        [source.id],
      );
      const locationMap = new Map<string, string>();
      for (const row of previous.rows) {
        const copy = locations.rows.find((item) => item.name === row.name);
        if (copy) locationMap.set(row.id, copy.id);
      }

      const activities = await client.query<{
        location_id: string | null;
        title: string;
        description: string;
        type: string;
        starts_at: Date;
        ends_at: Date;
        capacity: number | null;
        requires_enrollment: boolean;
        grants_stamp: boolean;
        responsible: string;
        display_order: number;
      }>(
        `SELECT location_id, title, description, type, starts_at, ends_at, capacity,
                requires_enrollment, grants_stamp, responsible, display_order
         FROM activities WHERE event_id = $1 ORDER BY display_order`,
        [source.id],
      );
      for (const activity of activities.rows) {
        await client.query(
          `INSERT INTO activities (
             id, event_id, location_id, title, description, type, starts_at, ends_at,
             capacity, requires_enrollment, grants_stamp, responsible, display_order, updated_at
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
           )`,
          [
            id,
            activity.location_id ? (locationMap.get(activity.location_id) ?? null) : null,
            activity.title,
            activity.description,
            activity.type,
            activity.starts_at,
            activity.ends_at,
            activity.capacity,
            activity.requires_enrollment,
            activity.grants_stamp,
            activity.responsible,
            activity.display_order,
          ],
        );
      }

      await client.query(
        `INSERT INTO form_fields (
           id, event_id, label, help, type, required, options, categories, display_order, updated_at
         )
         SELECT gen_random_uuid(), $1, label, help, type, required, options, categories, display_order, NOW()
         FROM form_fields WHERE event_id = $2`,
        [id, source.id],
      );

      if (organizerUserId && UUID.test(organizerUserId)) {
        await client.query(
          `INSERT INTO event_members (id, user_id, event_id, role)
           VALUES (gen_random_uuid(), $1, $2, 'ORGANIZER')
           ON CONFLICT (user_id, event_id) DO NOTHING`,
          [organizerUserId, id],
        );
      }

      await client.query('COMMIT');
      const created = await this.findById(id);
      if (!created) throw new Error('Não foi possível duplicar o evento.');
      return created;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async bannerInUse(banner: string, exceptId: string): Promise<boolean> {
    const result = await this.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM events WHERE banner = $1 AND id <> $2`,
      [banner, exceptId],
    );
    return (result.rows[0]?.count ?? 0) > 0;
  }

  async announcements(eventId: string): Promise<AnnouncementRecord[]> {
    const result = await this.pool.query<{
      id: string;
      title: string;
      body: string;
      published_at: Date;
    }>(
      `SELECT id, title, body, published_at
       FROM announcements
       WHERE event_id = $1 AND published_at IS NOT NULL
       ORDER BY published_at DESC`,
      [eventId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      publishedAt: row.published_at.toISOString(),
    }));
  }

  async rules(eventId: string): Promise<RuleRecord[]> {
    const result = await this.pool.query<{ id: string; title: string; rules: string }>(
      `SELECT c.id, a.title, c.rules
       FROM competitions c
       JOIN activities a ON a.id = c.activity_id
       WHERE a.event_id = $1 AND c.rules IS NOT NULL AND btrim(c.rules) <> ''
       ORDER BY a.starts_at, a.title`,
      [eventId],
    );
    return result.rows;
  }

  async locations(eventId: string): Promise<LocationRecord[]> {
    const result = await this.pool.query<{ id: string; name: string; notes: string | null }>(
      `SELECT id, name, notes FROM locations WHERE event_id = $1 ORDER BY name`,
      [eventId],
    );
    return result.rows;
  }

  async createLocation(
    eventId: string,
    input: { name: string; notes: string | null },
  ): Promise<LocationRecord> {
    const result = await this.pool.query<LocationRecord>(
      `INSERT INTO locations (id, event_id, name, notes, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())
       RETURNING id, name, notes`,
      [eventId, input.name, input.notes],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Não foi possível criar o local.');
    return row;
  }

  async deleteLocation(eventId: string, locationId: string): Promise<boolean> {
    if (!UUID.test(locationId)) return false;
    const result = await this.pool.query(
      `DELETE FROM locations WHERE id = $1 AND event_id = $2`,
      [locationId, eventId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async members(eventId: string): Promise<MemberRecord[]> {
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      name: string;
      email: string;
      role: string;
    }>(
      `SELECT m.id, m.user_id, u.name, u.email, m.role
       FROM event_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.event_id = $1
       ORDER BY u.name`,
      [eventId],
    );
    return result.rows.flatMap((row) => {
      if (!isTeamRole(row.role)) return [];
      return [
        {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          email: row.email,
          role: row.role,
        },
      ];
    });
  }

  async findUserByEmail(
    email: string,
  ): Promise<{ id: string; name: string; email: string } | null> {
    const result = await this.pool.query<{ id: string; name: string; email: string }>(
      `SELECT id, name, email FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async upsertMember(
    eventId: string,
    userId: string,
    role: TeamRole,
  ): Promise<MemberRecord | null> {
    await this.pool.query(
      `INSERT INTO event_members (id, user_id, event_id, role)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (user_id, event_id) DO UPDATE SET role = EXCLUDED.role`,
      [userId, eventId, role],
    );
    const members = await this.members(eventId);
    return members.find((member) => member.userId === userId) ?? null;
  }

  async updateMemberRole(
    eventId: string,
    memberId: string,
    role: TeamRole,
  ): Promise<MemberRecord | null> {
    if (!UUID.test(memberId)) return null;
    const result = await this.pool.query<{ user_id: string }>(
      `UPDATE event_members SET role = $3 WHERE id = $1 AND event_id = $2 RETURNING user_id`,
      [memberId, eventId, role],
    );
    const userId = result.rows[0]?.user_id;
    if (!userId) return null;
    const members = await this.members(eventId);
    return members.find((member) => member.userId === userId) ?? null;
  }

  async deleteMember(eventId: string, memberId: string): Promise<boolean> {
    if (!UUID.test(memberId)) return false;
    const result = await this.pool.query(
      `DELETE FROM event_members WHERE id = $1 AND event_id = $2`,
      [memberId, eventId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async activities(eventId: string): Promise<ActivityRecord[]> {
    const result = await this.pool.query<ActivitySql>(
      `SELECT ${ACTIVITY_COLUMNS}
       FROM activities WHERE event_id = $1
       ORDER BY display_order, starts_at`,
      [eventId],
    );
    return result.rows.flatMap((row) => {
      const activity = mapActivity(row);
      return activity ? [activity] : [];
    });
  }

  async createActivity(eventId: string, input: ActivityWrite): Promise<void> {
    await this.createActivities(eventId, [input]);
  }

  async createActivities(eventId: string, inputs: ActivityWrite[]): Promise<void> {
    if (inputs.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const input of inputs) {
        await client.query(
          `INSERT INTO activities (
             id, event_id, location_id, title, description, type, starts_at, ends_at,
             capacity, requires_enrollment, grants_stamp, responsible, display_order, updated_at
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             (SELECT COALESCE(MAX(display_order), 0) + 1 FROM activities WHERE event_id = $1),
             NOW()
           )`,
          activityParams(eventId, input),
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateActivity(
    eventId: string,
    activityId: string,
    input: ActivityWrite,
  ): Promise<boolean> {
    if (!UUID.test(activityId)) return false;
    const result = await this.pool.query(
      `UPDATE activities SET
         location_id = $2,
         title = $3,
         description = $4,
         type = $5,
         starts_at = $6,
         ends_at = $7,
         capacity = $8,
         requires_enrollment = $9,
         grants_stamp = $10,
         responsible = $11,
         updated_at = NOW()
       WHERE event_id = $1 AND id = $12`,
      [...activityParams(eventId, input), activityId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async duplicateActivity(eventId: string, activityId: string): Promise<boolean> {
    if (!UUID.test(activityId)) return false;
    const result = await this.pool.query(
      `INSERT INTO activities (
         id, event_id, location_id, title, description, type, starts_at, ends_at,
         capacity, requires_enrollment, grants_stamp, responsible, display_order, updated_at
       )
       SELECT
         gen_random_uuid(), event_id, location_id,
         LEFT(title, 112) || ' (cópia)', description, type, starts_at, ends_at,
         capacity, requires_enrollment, grants_stamp, responsible,
         (SELECT COALESCE(MAX(display_order), 0) + 1 FROM activities WHERE event_id = $2),
         NOW()
       FROM activities
       WHERE id = $1 AND event_id = $2`,
      [activityId, eventId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async reorderActivities(eventId: string, ids: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [index, id] of ids.entries()) {
        const result = await client.query(
          `UPDATE activities SET display_order = $1, updated_at = NOW()
           WHERE id = $2 AND event_id = $3`,
          [index + 1, id, eventId],
        );
        if ((result.rowCount ?? 0) !== 1) throw new Error('Não foi possível reordenar.');
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteActivity(eventId: string, activityId: string): Promise<boolean> {
    if (!UUID.test(activityId)) return false;
    const result = await this.pool.query(
      `DELETE FROM activities WHERE id = $1 AND event_id = $2`,
      [activityId, eventId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async formFields(eventId: string): Promise<FormFieldRecord[]> {
    const result = await this.pool.query<FormFieldSql>(
      `SELECT ${FORM_COLUMNS} FROM form_fields WHERE event_id = $1 ORDER BY display_order, label`,
      [eventId],
    );
    return result.rows.flatMap((row) => {
      const field = mapFormField(row);
      return field ? [field] : [];
    });
  }

  async createFormFields(eventId: string, inputs: FormFieldWrite[]): Promise<void> {
    if (inputs.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const input of inputs) {
        await client.query(
          `INSERT INTO form_fields (
             id, event_id, label, help, type, required, options, categories, display_order, updated_at
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::"RegistrationCategory"[],
             (SELECT COALESCE(MAX(display_order), 0) + 1 FROM form_fields WHERE event_id = $1),
             NOW()
           )`,
          [
            eventId,
            input.label,
            input.help,
            input.type,
            input.required,
            input.options,
            input.categories,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateFormField(
    eventId: string,
    fieldId: string,
    input: FormFieldWrite,
  ): Promise<boolean> {
    if (!UUID.test(fieldId)) return false;
    const result = await this.pool.query(
      `UPDATE form_fields SET
         label = $3,
         help = $4,
         type = $5,
         required = $6,
         options = $7,
         categories = $8::"RegistrationCategory"[],
         updated_at = NOW()
       WHERE event_id = $1 AND id = $2`,
      [
        eventId,
        fieldId,
        input.label,
        input.help,
        input.type,
        input.required,
        input.options,
        input.categories,
      ],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async reorderFormFields(eventId: string, ids: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE form_fields SET display_order = -display_order, updated_at = NOW() WHERE event_id = $1`,
        [eventId],
      );
      for (const [index, id] of ids.entries()) {
        const result = await client.query(
          `UPDATE form_fields SET display_order = $1, updated_at = NOW()
           WHERE id = $2 AND event_id = $3`,
          [index + 1, id, eventId],
        );
        if ((result.rowCount ?? 0) !== 1) throw new Error('Não foi possível reordenar.');
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteFormField(eventId: string, fieldId: string): Promise<boolean> {
    if (!UUID.test(fieldId)) return false;
    const result = await this.pool.query(
      `DELETE FROM form_fields WHERE id = $1 AND event_id = $2`,
      [fieldId, eventId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listParticipants(eventId: string): Promise<ParticipantRecord[]> {
    if (!UUID.test(eventId)) return [];
    const result = await this.pool.query<{
      id: string;
      status: string;
      created_at: Date;
      name: string | null;
      email: string | null;
      phone: string | null;
      heard: string | null;
      cpf: string | null;
    }>(
      `SELECT r.id,
              r.status,
              r.created_at,
              r.answers->>'name' AS name,
              r.answers->>'email' AS email,
              r.answers->>'phone' AS phone,
              r.answers->>heard.id AS heard,
              u.cpf
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN LATERAL (
         SELECT id::text AS id
         FROM form_fields
         WHERE event_id = r.event_id AND label = 'Como soube do evento'
         LIMIT 1
       ) heard ON true
       WHERE r.event_id = $1
       ORDER BY r.created_at DESC`,
      [eventId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      cpf: row.cpf ?? '',
      heard: row.heard ?? '',
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async createRegistration(input: {
    userId: string;
    eventId: string;
    passportCode: string;
    category: RegistrationCategory;
    answers: Record<string, unknown>;
  }): Promise<{ id: string; passportCode: string }> {
    const result = await this.pool.query<{ id: string; passport_code: string }>(
      `INSERT INTO registrations (
         id, user_id, event_id, passport_code, category, answers, status, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, 'CONFIRMED', NOW()
       ) RETURNING id, passport_code`,
      [
        input.userId,
        input.eventId,
        input.passportCode,
        input.category,
        JSON.stringify(input.answers),
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Não foi possível criar a inscrição.');
    return { id: row.id, passportCode: row.passport_code };
  }

  async deleteBySlugPrefix(prefix: string): Promise<void> {
    await this.pool.query(`DELETE FROM events WHERE slug LIKE $1`, [`${prefix}%`]);
  }
}

const ACTIVITY_COLUMNS = `
  id, location_id, title, description, type, starts_at, ends_at,
  capacity, requires_enrollment, grants_stamp, responsible, display_order
`;

type ActivitySql = {
  id: string;
  location_id: string | null;
  title: string;
  description: string;
  type: string;
  starts_at: Date;
  ends_at: Date;
  capacity: number | null;
  requires_enrollment: boolean;
  grants_stamp: boolean;
  responsible: string;
  display_order: number;
};

function activityParams(eventId: string, input: ActivityWrite): unknown[] {
  return [
    eventId,
    input.locationId,
    input.title,
    input.description,
    input.type,
    input.startsAt,
    input.endsAt,
    input.capacity,
    input.requiresEnrollment,
    input.grantsStamp,
    input.responsible,
  ];
}

const FORM_COLUMNS = `
  id, label, help, type, required, options, categories, display_order
`;

type FormFieldSql = {
  id: string;
  label: string;
  help: string;
  type: string;
  required: boolean;
  options: string[] | null;
  categories: string[] | string | null;
  display_order: number;
};

function mapFormField(row: FormFieldSql): FormFieldRecord | null {
  if (!isFieldType(row.type)) return null;
  return {
    id: row.id,
    label: row.label,
    help: row.help,
    type: row.type,
    required: row.required,
    options: row.options ?? [],
    categories: pgList(row.categories).flatMap((item) => (isCategory(item) ? [item] : [])),
    displayOrder: row.display_order,
  };
}

function pgList(value: string[] | string | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  const text = value.trim();
  if (text === '{}' || text.length < 2) return [];
  return text
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function isFieldType(type: string): type is FieldType {
  return type === 'TEXT' || type === 'LONGTEXT' || type === 'SELECT' || type === 'CHECKBOX' || type === 'NUMBER';
}

function isCategory(value: string): value is RegistrationCategory {
  return value === 'VISITOR' || value === 'SCHOOL' || value === 'COMPETITOR' || value === 'STAFF';
}

function mapActivity(row: ActivitySql): ActivityRecord | null {
  if (!isActivityType(row.type)) return null;
  return {
    id: row.id,
    locationId: row.location_id,
    title: row.title,
    description: row.description,
    type: row.type,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    capacity: row.capacity,
    requiresEnrollment: row.requires_enrollment,
    grantsStamp: row.grants_stamp,
    responsible: row.responsible,
    displayOrder: row.display_order,
  };
}

function mapEvent(row: EventSql): EventRecord {
  if (row.status !== 'DRAFT' && row.status !== 'PUBLISHED' && row.status !== 'CLOSED') {
    throw new Error('Status de evento desconhecido.');
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    theme: row.theme,
    place: row.place,
    address: row.address,
    startsAt: row.starts_at ? row.starts_at.toISOString() : null,
    endsAt: row.ends_at ? row.ends_at.toISOString() : null,
    banner: row.banner,
    status: row.status,
    registrationsOpen: row.registrations_open,
    colorPrimary: row.color_primary,
    colorSecondary: row.color_secondary,
    colorAccent: row.color_accent,
    registrationCount: row.registration_count,
    activityCount: row.activity_count,
  };
}

function isTeamRole(role: string): role is TeamRole {
  return role === 'ORGANIZER' || role === 'STAFF' || role === 'MONITOR' || role === 'JUDGE';
}

function isActivityType(type: string): type is ActivityType {
  return (
    type === 'STAND' ||
    type === 'TALK' ||
    type === 'WORKSHOP' ||
    type === 'COMPETITION' ||
    type === 'CULTURAL' ||
    type === 'OTHER'
  );
}
