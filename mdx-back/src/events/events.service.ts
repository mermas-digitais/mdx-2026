import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { ZodError, ZodType } from 'zod';
import type { AuthUser } from '../server/permissions.js';
import { canManageEvent } from '../server/permissions.js';
import {
  activityPatchSchema,
  activitySchema,
  bannerError,
  dateOrderMessage,
  eventCreateSchema,
  eventPatchSchema,
  findScheduleConflicts,
  locationSchema,
  memberRoleSchema,
  memberSchema,
  planSteamStands,
  publishBlockers,
  reorderSchema,
  zodFields,
  type EventWrite,
  type ScheduleConflict,
} from '../server/event-schema.js';
import {
  competitorQuestions,
  cpfDigits,
  formFieldPatchSchema,
  formFieldSchema,
  formIssues,
  registrationSchema,
  reorderSchema as formReorderSchema,
  storedAnswers,
} from '../server/form-schema.js';
import {
  EventsRepository,
  type ActivityRecord,
  type ActivityWrite,
  type AnnouncementRecord,
  type EventPatch,
  type EventRecord,
  type FormFieldRecord,
  type FormFieldWrite,
  type LocationRecord,
  type MemberRecord,
  type RuleRecord,
} from './events.repository.js';
import { RoboticsRepository, type ModalityVacancy } from './robotics.repository.js';

const uploadsDir = path.join(process.cwd(), 'uploads');

export type AdminEvent = EventRecord & {
  publishBlockers: string[];
  canManage: boolean;
};

export type AdminEventDetail = AdminEvent & {
  locations: LocationRecord[];
  members: MemberRecord[];
  activities: ActivityRecord[];
  conflicts: ScheduleConflict[];
  formFields: FormFieldRecord[];
};

export type PublicEvent = {
  slug: string;
  title: string;
  description: string;
  theme: string;
  place: string;
  address: string;
  startsAt: string | null;
  endsAt: string | null;
  banner: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  registrationsOpen: boolean;
  preview: boolean;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorAccent: string | null;
  fields: FormFieldRecord[];
  locations: LocationRecord[];
  activities: ActivityRecord[];
  announcements: AnnouncementRecord[];
  rules: RuleRecord[];
  modalities: ModalityVacancy[];
};

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    private readonly events: EventsRepository,
    private readonly robotics: RoboticsRepository,
  ) {}

  async onModuleInit() {
    await mkdir(uploadsDir, { recursive: true });
  }

  async list(user: AuthUser): Promise<AdminEvent[]> {
    const ids = user.role === 'ADMIN' ? null : user.memberships.map((item) => item.eventId);
    const rows = await this.events.list(ids);
    return rows.map((event) => this.present(user, event));
  }

  async detail(user: AuthUser, eventId: string): Promise<AdminEventDetail> {
    const event = await this.requireEvent(eventId);
    const [locations, members, activities, formFields] = await Promise.all([
      this.events.locations(eventId),
      this.events.members(eventId),
      this.events.activities(eventId),
      this.events.formFields(eventId),
    ]);
    return {
      ...this.present(user, event),
      locations,
      members,
      activities,
      conflicts: findScheduleConflicts(activities),
      formFields,
    };
  }

  async create(input: unknown): Promise<AdminEventDetail> {
    const data = this.parse(eventCreateSchema, input);
    this.assertDates(data.startsAt, data.endsAt);
    await this.assertSlugFree(data.slug);
    try {
      const created = await this.events.create({
        title: data.title,
        slug: data.slug,
        theme: data.theme ?? '',
        description: data.description ?? '',
        place: data.place ?? '',
        address: data.address ?? '',
        startsAt: data.startsAt ?? null,
        endsAt: data.endsAt ?? null,
        colorPrimary: data.colorPrimary ?? null,
        colorSecondary: data.colorSecondary ?? null,
        colorAccent: data.colorAccent ?? null,
      });
      return this.detail({ id: '', role: 'ADMIN', memberships: [] }, created.id);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async update(eventId: string, input: unknown, user: AuthUser): Promise<AdminEventDetail> {
    const current = await this.requireEvent(eventId);
    const patch = this.parse(eventPatchSchema, input);
    const startsAt = patch.startsAt !== undefined ? patch.startsAt : current.startsAt;
    const endsAt = patch.endsAt !== undefined ? patch.endsAt : current.endsAt;
    this.assertDates(startsAt, endsAt);
    if (patch.slug && patch.slug !== current.slug) {
      await this.assertSlugFree(patch.slug, eventId);
    }
    const stored = this.toPatch(patch);
    try {
      await this.events.update(eventId, stored);
    } catch (error) {
      this.rethrowUnique(error);
    }
    return this.detail(user, eventId);
  }

  async duplicate(user: AuthUser, eventId: string): Promise<AdminEventDetail> {
    const source = await this.requireEvent(eventId);
    const slug = await this.availableSlug(`${source.slug}-copia`);
    const organizerUserId = user.role === 'ADMIN' ? null : user.id;
    try {
      const copy = await this.events.duplicate(source, slug, organizerUserId);
      return this.detail(user, copy.id);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async publish(user: AuthUser, eventId: string): Promise<AdminEventDetail> {
    const event = await this.requireEvent(eventId);
    if (event.status === 'CLOSED') {
      throw new BadRequestException('Um evento encerrado não volta a ser publicado por aqui.');
    }
    const blockers = publishBlockers(event);
    if (blockers.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'O evento ainda não pode ser publicado.',
        blockers,
      });
    }
    await this.events.update(eventId, { status: 'PUBLISHED' });
    return this.detail(user, eventId);
  }

  async close(user: AuthUser, eventId: string): Promise<AdminEventDetail> {
    const event = await this.requireEvent(eventId);
    if (event.status !== 'PUBLISHED') {
      throw new BadRequestException('Só um evento publicado pode ser encerrado.');
    }
    await this.events.update(eventId, { status: 'CLOSED' });
    return this.detail(user, eventId);
  }

  async saveBanner(
    user: AuthUser,
    eventId: string,
    file: { mimetype: string; size: number; buffer: Buffer } | undefined,
  ): Promise<AdminEventDetail> {
    const event = await this.requireEvent(eventId);
    if (!file) throw new BadRequestException('Escolha uma imagem.');
    const message = bannerError({
      mimetype: file.mimetype,
      size: file.size,
      bytes: file.buffer,
    });
    if (message) throw new BadRequestException(message);
    const extension =
      file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${randomUUID()}.${extension}`;
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, filename), file.buffer);
    const previous = event.banner;
    await this.events.update(eventId, { banner: `/api/uploads/${filename}` });
    await this.removeBannerFile(previous, eventId);
    return this.detail(user, eventId);
  }

  async createLocation(eventId: string, input: unknown, user: AuthUser) {
    await this.requireEvent(eventId);
    const data = this.parse(locationSchema, input);
    try {
      await this.events.createLocation(eventId, {
        name: data.name,
        notes: data.notes?.trim() ? data.notes : null,
      });
    } catch (error) {
      this.rethrowUnique(error);
    }
    return this.detail(user, eventId);
  }

  async deleteLocation(eventId: string, locationId: string, user: AuthUser) {
    await this.requireEvent(eventId);
    const removed = await this.events.deleteLocation(eventId, locationId);
    if (!removed) throw new NotFoundException('Local não encontrado.');
    return this.detail(user, eventId);
  }

  async invite(eventId: string, input: unknown, user: AuthUser) {
    await this.requireEvent(eventId);
    const data = this.parse(memberSchema, input);
    const account = await this.events.findUserByEmail(data.email);
    if (!account) throw new NotFoundException('Não há conta com esse e-mail.');
    await this.events.upsertMember(eventId, account.id, data.role);
    return this.detail(user, eventId);
  }

  async changeRole(eventId: string, memberId: string, input: unknown, user: AuthUser) {
    await this.requireEvent(eventId);
    const data = this.parse(memberRoleSchema, input);
    const updated = await this.events.updateMemberRole(eventId, memberId, data.role);
    if (!updated) throw new NotFoundException('Pessoa não encontrada na equipe.');
    return this.detail(user, eventId);
  }

  async removeMember(eventId: string, memberId: string, user: AuthUser) {
    await this.requireEvent(eventId);
    const removed = await this.events.deleteMember(eventId, memberId);
    if (!removed) throw new NotFoundException('Pessoa não encontrada na equipe.');
    return this.detail(user, eventId);
  }

  async createActivity(eventId: string, input: unknown, user: AuthUser) {
    await this.requireEvent(eventId);
    const data = this.parse(activitySchema, input);
    await this.assertActivityLocation(eventId, data.locationId ?? null);
    await this.events.createActivity(eventId, toActivityWrite(data));
    return this.detail(user, eventId);
  }

  async updateActivity(
    eventId: string,
    activityId: string,
    input: unknown,
    user: AuthUser,
  ) {
    await this.requireEvent(eventId);
    const current = (await this.events.activities(eventId)).find((item) => item.id === activityId);
    if (!current) throw new NotFoundException('Atividade não encontrada.');
    const patch = this.parse(activityPatchSchema, input);
    const data = this.parse(activitySchema, {
      title: patch.title ?? current.title,
      description: patch.description ?? current.description,
      type: patch.type ?? current.type,
      locationId: patch.locationId !== undefined ? patch.locationId : current.locationId,
      startsAt: patch.startsAt ?? current.startsAt,
      endsAt: patch.endsAt ?? current.endsAt,
      responsible: patch.responsible ?? current.responsible,
      capacity: patch.capacity !== undefined ? patch.capacity : current.capacity,
      requiresEnrollment: patch.requiresEnrollment ?? current.requiresEnrollment,
      grantsStamp: patch.grantsStamp ?? current.grantsStamp,
    });
    await this.assertActivityLocation(eventId, data.locationId ?? null);
    const updated = await this.events.updateActivity(eventId, activityId, toActivityWrite(data));
    if (!updated) throw new NotFoundException('Atividade não encontrada.');
    return this.detail(user, eventId);
  }

  async duplicateActivity(eventId: string, activityId: string, user: AuthUser) {
    await this.requireEvent(eventId);
    const copied = await this.events.duplicateActivity(eventId, activityId);
    if (!copied) throw new NotFoundException('Atividade não encontrada.');
    return this.detail(user, eventId);
  }

  async reorderActivities(eventId: string, input: unknown, user: AuthUser) {
    await this.requireEvent(eventId);
    const data = this.parse(reorderSchema, input);
    const current = await this.events.activities(eventId);
    const known = new Set(current.map((item) => item.id));
    const unique = new Set(data.ids);
    if (data.ids.length !== current.length || unique.size !== data.ids.length || data.ids.some((id) => !known.has(id))) {
      throw new BadRequestException('A ordem precisa incluir todas as atividades.');
    }
    await this.events.reorderActivities(eventId, data.ids);
    return this.detail(user, eventId);
  }

  async createSteamStands(eventId: string, user: AuthUser) {
    const event = await this.requireEvent(eventId);
    const [locations, activities] = await Promise.all([
      this.events.locations(eventId),
      this.events.activities(eventId),
    ]);
    const planned = planSteamStands({
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      locationIds: locations.map((item) => item.id),
      existing: activities,
    });
    await this.events.createActivities(
      eventId,
      planned.map((item) => ({
        locationId: item.locationId,
        title: item.title,
        description: item.description,
        type: 'STAND' as const,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        capacity: null,
        requiresEnrollment: false,
        grantsStamp: true,
        responsible: 'Equipe STEAM',
      })),
    );
    return this.detail(user, eventId);
  }

  async deleteActivity(eventId: string, activityId: string, user: AuthUser) {
    await this.requireEvent(eventId);
    const removed = await this.events.deleteActivity(eventId, activityId);
    if (!removed) throw new NotFoundException('Atividade não encontrada.');
    return this.detail(user, eventId);
  }

  async publicBySlug(slug: string): Promise<PublicEvent> {
    const event = await this.events.findPublicBySlug(slug);
    if (!event || (event.status !== 'PUBLISHED' && event.status !== 'CLOSED')) {
      throw new NotFoundException('Evento não encontrado.');
    }
    return this.toPublic(event, false);
  }

  async previewBySlug(slug: string, user: AuthUser): Promise<PublicEvent> {
    const event = await this.events.findBySlug(slug);
    if (!event || !canManageEvent(user, event.id)) {
      throw new NotFoundException('Evento não encontrado.');
    }
    return this.toPublic(event, event.status === 'DRAFT');
  }

  async createFormField(eventId: string, input: unknown, user: AuthUser) {
    await this.requireEvent(eventId);
    const data = this.parse(formFieldSchema, input);
    try {
      await this.events.createFormFields(eventId, [toFormWrite(data)]);
    } catch (error) {
      this.rethrowUnique(error);
    }
    return this.detail(user, eventId);
  }

  async updateFormField(eventId: string, fieldId: string, input: unknown, user: AuthUser) {
    await this.requireEvent(eventId);
    const current = (await this.events.formFields(eventId)).find((item) => item.id === fieldId);
    if (!current) throw new NotFoundException('Campo não encontrado.');
    const patch = this.parse(formFieldPatchSchema, input);
    const data = this.parse(formFieldSchema, {
      label: patch.label ?? current.label,
      help: patch.help ?? current.help,
      type: patch.type ?? current.type,
      required: patch.required ?? current.required,
      options: patch.options ?? current.options,
      categories: patch.categories ?? current.categories,
    });
    const updated = await this.events.updateFormField(eventId, fieldId, toFormWrite(data));
    if (!updated) throw new NotFoundException('Campo não encontrado.');
    return this.detail(user, eventId);
  }

  async reorderFormFields(eventId: string, input: unknown, user: AuthUser) {
    await this.requireEvent(eventId);
    const data = this.parse(formReorderSchema, input);
    const current = await this.events.formFields(eventId);
    const known = new Set(current.map((item) => item.id));
    const unique = new Set(data.ids);
    if (
      data.ids.length !== current.length ||
      unique.size !== data.ids.length ||
      data.ids.some((id) => !known.has(id))
    ) {
      throw new BadRequestException('A ordem precisa incluir todos os campos.');
    }
    await this.events.reorderFormFields(eventId, data.ids);
    return this.detail(user, eventId);
  }

  async createCompetitorFields(eventId: string, user: AuthUser) {
    await this.requireEvent(eventId);
    const [fields, activities] = await Promise.all([
      this.events.formFields(eventId),
      this.events.activities(eventId),
    ]);
    const taken = new Set(fields.map((item) => item.label));
    const provas = activities
      .filter((item) => item.type === 'COMPETITION')
      .map((item) => item.title);
    const options = provas.length > 0 ? provas : ['Prova geral'];
    const planned = competitorQuestions
      .filter((item) => !taken.has(item.label))
      .map((item) => ({
        label: item.label,
        help: item.help,
        type: item.type,
        required: item.required,
        options: item.type === 'SELECT' ? options : [],
        categories: ['COMPETITOR' as const],
      }));
    try {
      await this.events.createFormFields(eventId, planned);
    } catch (error) {
      this.rethrowUnique(error);
    }
    return this.detail(user, eventId);
  }

  async deleteFormField(eventId: string, fieldId: string, user: AuthUser) {
    await this.requireEvent(eventId);
    const removed = await this.events.deleteFormField(eventId, fieldId);
    if (!removed) throw new NotFoundException('Campo não encontrado.');
    return this.detail(user, eventId);
  }

  async register(slug: string, input: unknown, user: AuthUser) {
    const event = await this.events.findPublicBySlug(slug);
    if (!event || event.status !== 'PUBLISHED') {
      throw new NotFoundException('Evento não encontrado.');
    }
    const fields = await this.events.formFields(event.id);
    const parsed = registrationSchema(fields).safeParse(normalize(input));
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Revise os campos.',
        fields: formIssues(parsed.error),
      });
    }
    if (parsed.data.category === 'COMPETITOR' || parsed.data.category === 'STAFF') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Revise os campos.',
        fields: {
          category: 'A competição é inscrita pelo orientador. Escolha participante.',
        },
      });
    }
    const assigned = await this.robotics.assignCpf(user.id, cpfDigits(parsed.data.cpf));
    if (assigned === 'mismatch') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Revise os campos.',
        fields: { cpf: 'O CPF da conta é outro.' },
      });
    }
    if (assigned === 'taken') {
      throw new ConflictException('Já existe uma conta com esse CPF.');
    }
    const answers = storedAnswers(fields, parsed.data);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const created = await this.events.createRegistration({
          userId: user.id,
          eventId: event.id,
          passportCode: passportCode(),
          category: parsed.data.category,
          answers,
        });
        return created;
      } catch (error) {
        const constraint = uniqueConstraint(error);
        if (constraint === 'registrations_user_id_event_id_key') {
          throw new ConflictException('Você já está inscrita neste evento.');
        }
        if (constraint === 'registrations_passport_code_key') continue;
        throw error;
      }
    }
    throw new ConflictException('Não foi possível gerar o código da inscrição.');
  }

  private async toPublic(event: EventRecord, preview: boolean): Promise<PublicEvent> {
    const [fields, locations, activities, announcements, rules, modalities] = await Promise.all([
      this.events.formFields(event.id),
      this.events.locations(event.id),
      this.events.activities(event.id),
      this.events.announcements(event.id),
      this.events.rules(event.id),
      this.robotics.vacancies(event.id),
    ]);
    return {
      slug: event.slug,
      title: event.title,
      description: event.description,
      theme: event.theme,
      place: event.place,
      address: event.address,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      banner: event.banner,
      status: event.status,
      registrationsOpen: event.registrationsOpen,
      preview,
      colorPrimary: event.colorPrimary,
      colorSecondary: event.colorSecondary,
      colorAccent: event.colorAccent,
      fields,
      locations,
      activities,
      announcements,
      rules,
      modalities,
    };
  }

  private present(user: AuthUser, event: EventRecord): AdminEvent {
    return {
      ...event,
      publishBlockers: publishBlockers(event),
      canManage: canManageEvent(user, event.id),
    };
  }

  private async requireEvent(eventId: string): Promise<EventRecord> {
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundException('Evento não encontrado.');
    return event;
  }

  private parse<T>(schema: ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(normalize(input));
    if (!parsed.success) throw invalid(parsed.error);
    return parsed.data;
  }

  private assertDates(
    startsAt: string | null | undefined,
    endsAt: string | null | undefined,
  ) {
    const message = dateOrderMessage(startsAt, endsAt);
    if (!message) return;
    throw new BadRequestException({
      statusCode: 400,
      message: 'Revise os campos.',
      fields: { endsAt: message },
    });
  }

  private async assertSlugFree(slug: string, exceptId?: string) {
    const owner = await this.events.slugOwner(slug);
    if (owner && owner !== exceptId) {
      throw new ConflictException('Já existe um evento com esse endereço.');
    }
  }

  private async availableSlug(base: string): Promise<string> {
    const root = base.replace(/-+$/g, '').slice(0, 80) || 'evento';
    let candidate = root;
    for (let attempt = 2; attempt < 40; attempt += 1) {
      const owner = await this.events.slugOwner(candidate);
      if (!owner) return candidate;
      const suffix = `-${attempt}`;
      candidate = `${root.slice(0, 80 - suffix.length)}${suffix}`;
    }
    throw new ConflictException('Já existe um evento com esse endereço.');
  }

  private toPatch(patch: Partial<EventWrite>): EventPatch {
    const stored: EventPatch = {};
    if (patch.title !== undefined) stored.title = patch.title;
    if (patch.slug !== undefined) stored.slug = patch.slug;
    if (patch.theme !== undefined) stored.theme = patch.theme;
    if (patch.description !== undefined) stored.description = patch.description;
    if (patch.place !== undefined) stored.place = patch.place;
    if (patch.address !== undefined) stored.address = patch.address;
    if (patch.startsAt !== undefined) stored.startsAt = patch.startsAt;
    if (patch.endsAt !== undefined) stored.endsAt = patch.endsAt;
    if (patch.colorPrimary !== undefined) stored.colorPrimary = patch.colorPrimary;
    if (patch.colorSecondary !== undefined) stored.colorSecondary = patch.colorSecondary;
    if (patch.colorAccent !== undefined) stored.colorAccent = patch.colorAccent;
    return stored;
  }

  private rethrowUnique(error: unknown): never {
    const constraint = uniqueConstraint(error);
    if (constraint === 'events_slug_key') {
      throw new ConflictException('Já existe um evento com esse endereço.');
    }
    if (constraint === 'locations_event_id_name_key') {
      throw new ConflictException('Já existe um local com esse nome.');
    }
    if (constraint === 'form_fields_event_id_display_order_key') {
      throw new ConflictException('Não foi possível ordenar os campos. Tente de novo.');
    }
    throw error;
  }

  private async assertActivityLocation(eventId: string, locationId: string | null) {
    if (!locationId) return;
    const locations = await this.events.locations(eventId);
    if (locations.some((item) => item.id === locationId)) return;
    throw new BadRequestException({
      statusCode: 400,
      message: 'Revise os campos.',
      fields: { locationId: 'Escolha um local deste evento.' },
    });
  }

  private async removeBannerFile(banner: string | null, eventId: string) {
    if (!banner?.startsWith('/api/uploads/')) return;
    const filename = path.basename(banner);
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) return;
    if (await this.events.bannerInUse(banner, eventId)) return;
    await rm(path.join(uploadsDir, filename), { force: true });
  }
}

export function uploadPath(name: string): string | null {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(name)) return null;
  const full = path.resolve(uploadsDir, name);
  if (!full.startsWith(`${uploadsDir}${path.sep}`)) return null;
  return full;
}

function normalize(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const copy = { ...(input as Record<string, unknown>) };
  for (const key of [
    'startsAt',
    'endsAt',
    'colorPrimary',
    'colorSecondary',
    'colorAccent',
    'locationId',
    'capacity',
  ]) {
    if (copy[key] === '') copy[key] = null;
  }
  return copy;
}

function toFormWrite(data: {
  label: string;
  help?: string;
  type: FormFieldWrite['type'];
  required?: boolean;
  options?: string[];
  categories?: FormFieldWrite['categories'];
}): FormFieldWrite {
  return {
    label: data.label,
    help: data.help ?? '',
    type: data.type,
    required: data.required ?? false,
    options: data.options ?? [],
    categories: data.categories ?? [],
  };
}

function passportCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

function toActivityWrite(data: {
  title: string;
  description?: string;
  type: ActivityWrite['type'];
  locationId?: string | null;
  startsAt: string;
  endsAt: string;
  responsible: string;
  capacity?: number | null;
  requiresEnrollment?: boolean;
  grantsStamp?: boolean;
}): ActivityWrite {
  return {
    title: data.title,
    description: data.description ?? '',
    type: data.type,
    locationId: data.locationId ?? null,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    responsible: data.responsible,
    capacity: data.capacity ?? null,
    requiresEnrollment: data.requiresEnrollment ?? false,
    grantsStamp: data.grantsStamp ?? false,
  };
}

function invalid(error: ZodError): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    message: 'Revise os campos.',
    fields: zodFields(error),
  });
}

function uniqueConstraint(error: unknown): string | null {
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
