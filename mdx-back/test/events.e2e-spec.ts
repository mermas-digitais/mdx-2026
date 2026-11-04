import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { TokenService } from '../src/auth/token.service.js';
import { UsersRepository } from '../src/auth/users.repository.js';
import { BANNER_MAX_BYTES } from '../src/server/event-schema.js';
import { cpfFromSeed } from '../src/server/form-schema.js';
import type { AuthUser } from '../src/server/permissions.js';
import { EventsRepository } from '../src/events/events.repository.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Eventos (e2e)', () => {
  let app: INestApplication<App>;
  let tokens: TokenService;
  let users: UsersRepository;
  let events: EventsRepository;
  const stamp = Date.now();
  const slug = `painel-e2e-${stamp}`;
  const email = `painel-e2e-${stamp}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    tokens = app.get(TokenService);
    users = app.get(UsersRepository);
    events = app.get(EventsRepository);
  });

  afterAll(async () => {
    await events.deleteBySlugPrefix('painel-e2e-');
    await users.deleteByEmail(email);
    await users.deleteByEmail(`painel-e2e-form-${stamp}@example.com`);
    await app.close();
  });

  function bearer(user: AuthUser & { email: string }) {
    return tokens.sign(user);
  }

  it('cria, completa e publica um evento, e esconde o rascunho', async () => {
    const admin: AuthUser & { email: string } = {
      id: '00000000-0000-4000-8000-0000000000aa',
      email: 'admin-painel@example.com',
      role: 'ADMIN',
      memberships: [],
    };
    const token = await bearer(admin);
    const http = request(app.getHttpServer());

    const created = await http
      .post('/api/admin/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'MDX 2026', slug, theme: 'STEAM', description: 'Encontro.' })
      .expect(201);

    expect(created.body.status).toBe('DRAFT');
    expect(created.body.publishBlockers.length).toBeGreaterThan(0);
    const eventId = created.body.id as string;

    await http.get(`/api/events/${slug}`).expect(404);

    const blocked = await http
      .post(`/api/admin/events/${eventId}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(blocked.body.blockers).toEqual(expect.arrayContaining([
      'Informe o início e o fim.',
      'Informe o local.',
      'Cadastre pelo menos uma atividade.',
    ]));

    await http
      .patch(`/api/admin/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startsAt: '2026-11-25T21:00:00.000Z',
        endsAt: '2026-11-24T11:00:00.000Z',
      })
      .expect(400);

    await http
      .patch(`/api/admin/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        place: 'IFMA Imperatriz',
        address: 'Campus Imperatriz',
        startsAt: '2026-11-24T11:00:00.000Z',
        endsAt: '2026-11-25T21:00:00.000Z',
      })
      .expect(200);

    await http
      .post(`/api/admin/events/${eventId}/locations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Corredor principal', notes: 'Stands' })
      .expect(201);

    await http
      .post(`/api/admin/events/${eventId}/activities`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Stand de abertura',
        type: 'STAND',
        startsAt: '2026-11-24T11:00:00.000Z',
        endsAt: '2026-11-24T12:00:00.000Z',
        responsible: 'Ana Organizadora',
      })
      .expect(201);

    const published = await http
      .post(`/api/admin/events/${eventId}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(published.body.status).toBe('PUBLISHED');
    expect(published.body.publishBlockers).toEqual([]);

    const visible = await http.get(`/api/events/${slug}`).expect(200);
    expect(visible.body.title).toBe('MDX 2026');
    expect(visible.body.place).toBe('IFMA Imperatriz');
    expect(visible.body.preview).toBe(false);
    expect(visible.body.registrationsOpen).toBe(false);
    expect(visible.body.activities).toHaveLength(1);
    expect(visible.body.locations.map((item: { name: string }) => item.name)).toContain(
      'Corredor principal',
    );

    await http
      .post('/api/admin/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Outro', slug })
      .expect(409);

    const copy = await http
      .post(`/api/admin/events/${eventId}/duplicate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(copy.body.slug).toBe(`${slug}-copia`);
    expect(copy.body.status).toBe('DRAFT');
    expect(copy.body.activityCount).toBe(1);
    await http.get(`/api/events/${slug}-copia`).expect(404);
    await http.get(`/api/events/${slug}-copia/preview`).expect(401);
    const draft = await http
      .get(`/api/events/${slug}-copia/preview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(draft.body.preview).toBe(true);
    expect(draft.body.status).toBe('DRAFT');
    expect(draft.body.activities).toHaveLength(1);

    const organizer: AuthUser & { email: string } = {
      id: '00000000-0000-4000-8000-0000000000bb',
      email: 'org-painel@example.com',
      role: 'USER',
      memberships: [{ eventId, role: 'ORGANIZER' }],
    };
    const staff: AuthUser & { email: string } = {
      id: '00000000-0000-4000-8000-0000000000cc',
      email: 'staff-painel@example.com',
      role: 'USER',
      memberships: [{ eventId, role: 'STAFF' }],
    };
    await http
      .get(`/api/events/${slug}-copia/preview`)
      .set('Authorization', `Bearer ${await bearer(staff)}`)
      .expect(404);
    await http
      .patch(`/api/admin/events/${eventId}`)
      .set('Authorization', `Bearer ${await bearer(staff)}`)
      .send({ theme: 'Não' })
      .expect(403);
    await http
      .patch(`/api/admin/events/${eventId}`)
      .set('Authorization', `Bearer ${await bearer(organizer)}`)
      .send({ theme: 'STEAM' })
      .expect(200);

    await http
      .post('/api/auth/register')
      .send({ name: 'Pessoa Equipe', email, password: 'senha-segura-1', cpf: cpfFromSeed(stamp) })
      .expect(201);
    await http
      .post(`/api/admin/events/${eventId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, role: 'JUDGE' })
      .expect(201);
    await http
      .post(`/api/admin/events/${eventId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'ninguem@example.com', role: 'STAFF' })
      .expect(404);

    await http
      .post(`/api/admin/events/${eventId}/banner`)
      .set('Authorization', `Bearer ${token}`)
      .attach('banner', Buffer.from('nao-e-imagem'), 'foto.png')
      .expect(400);

    const uploaded = await http
      .post(`/api/admin/events/${eventId}/banner`)
      .set('Authorization', `Bearer ${token}`)
      .attach('banner', png, { filename: 'foto.png', contentType: 'image/png' })
      .expect(200);
    expect(uploaded.body.banner).toMatch(/^\/api\/uploads\/.+\.png$/);
    await http.get(uploaded.body.banner).expect(200);

    await http
      .post(`/api/admin/events/${eventId}/banner`)
      .set('Authorization', `Bearer ${token}`)
      .attach('banner', Buffer.alloc(BANNER_MAX_BYTES + 1), {
        filename: 'grande.png',
        contentType: 'image/png',
      })
      .expect(413);

    const closed = await http
      .post(`/api/admin/events/${eventId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(closed.body.status).toBe('CLOSED');
    const stillThere = await http.get(`/api/events/${slug}`).expect(200);
    expect(stillThere.body.status).toBe('CLOSED');
  });

  it('monta a grade, avisa conflito e duplica atividade', async () => {
    const admin: AuthUser & { email: string } = {
      id: '00000000-0000-4000-8000-0000000000aa',
      email: 'admin-painel@example.com',
      role: 'ADMIN',
      memberships: [],
    };
    const user: AuthUser & { email: string } = {
      id: '00000000-0000-4000-8000-0000000000bb',
      email: 'user-painel@example.com',
      role: 'USER',
      memberships: [],
    };
    const token = await bearer(admin);
    const http = request(app.getHttpServer());
    const gradeSlug = `painel-e2e-grade-${stamp}`;
    const created = await http
      .post('/api/admin/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Grade',
        slug: gradeSlug,
        startsAt: '2026-11-24T11:00:00.000Z',
        endsAt: '2026-11-25T21:00:00.000Z',
        place: 'IFMA Imperatriz',
      })
      .expect(201);
    const eventId = created.body.id as string;

    await http
      .post(`/api/admin/events/${eventId}/locations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Auditório' })
      .expect(201);
    await http
      .post(`/api/admin/events/${eventId}/locations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Pátio' })
      .expect(201);

    const steam = await http
      .post(`/api/admin/events/${eventId}/activities/steam`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const stands = steam.body.activities.filter(
      (activity: { type: string; grantsStamp: boolean }) => activity.type === 'STAND' && activity.grantsStamp,
    );
    expect(stands).toHaveLength(5);
    expect(steam.body.conflicts).toEqual([]);

    const auditorio = steam.body.locations.find(
      (location: { name: string }) => location.name === 'Auditório',
    ).id as string;
    const clash = await http
      .post(`/api/admin/events/${eventId}/activities`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Choque',
        type: 'OTHER',
        locationId: auditorio,
        startsAt: '2026-11-24T12:00:00.000Z',
        endsAt: '2026-11-24T13:00:00.000Z',
        responsible: 'Ana Organizadora',
      })
      .expect(201);
    expect(clash.body.conflicts.length).toBeGreaterThan(0);

    const ids = (clash.body.activities as { id: string }[]).map((activity) => activity.id).reverse();
    const ordered = await http
      .post(`/api/admin/events/${eventId}/activities/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ids })
      .expect(200);
    expect(ordered.body.activities[0].id).toBe(ids[0]);

    const duplicated = await http
      .post(`/api/admin/events/${eventId}/activities/${ids[0]}/duplicate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(
      duplicated.body.activities.some((activity: { title: string }) => activity.title.includes('(cópia)')),
    ).toBe(true);

    const userToken = await bearer(user);
    await http
      .post(`/api/admin/events/${eventId}/activities/steam`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('valida a inscrição com o campo criado no painel', async () => {
    const admin: AuthUser & { email: string } = {
      id: '00000000-0000-4000-8000-0000000000aa',
      email: 'admin-painel@example.com',
      role: 'ADMIN',
      memberships: [],
    };
    const token = await bearer(admin);
    const http = request(app.getHttpServer());
    const formSlug = `painel-e2e-form-${stamp}`;
    const created = await http
      .post('/api/admin/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Formulário',
        slug: formSlug,
        startsAt: '2026-11-24T11:00:00.000Z',
        endsAt: '2026-11-25T21:00:00.000Z',
        place: 'IFMA Imperatriz',
      })
      .expect(201);
    const eventId = created.body.id as string;
    await http
      .post(`/api/admin/events/${eventId}/activities`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Abertura',
        type: 'CULTURAL',
        startsAt: '2026-11-24T11:00:00.000Z',
        endsAt: '2026-11-24T12:00:00.000Z',
        responsible: 'Ana Organizadora',
      })
      .expect(201);
    await http
      .post(`/api/admin/events/${eventId}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const field = await http
      .post(`/api/admin/events/${eventId}/form-fields`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Como soube do evento',
        help: 'Pode ser uma pessoa ou um lugar.',
        type: 'TEXT',
        required: true,
      })
      .expect(201);
    const fieldId = field.body.formFields[0].id as string;
    const visible = await http.get(`/api/events/${formSlug}`).expect(200);
    expect(visible.body.fields.map((item: { label: string }) => item.label)).toContain(
      'Como soube do evento',
    );

    await http
      .post(`/api/admin/events/${eventId}/form-fields/competitor`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const formEmail = `painel-e2e-form-${stamp}@example.com`;
    const account = await http
      .post('/api/auth/register')
      .send({
        name: 'Marina Costa',
        email: formEmail,
        password: 'senha-segura-1',
        cpf: cpfFromSeed(stamp + 1),
      })
      .expect(201);
    const person = account.body.token as string;
    const answers = {
      name: 'Marina Costa',
      email: formEmail,
      cpf: cpfFromSeed(stamp + 1),
      phone: '99999999999',
      institution: 'IFMA',
    };

    const missing = await http
      .post(`/api/events/${formSlug}/registrations`)
      .set('Authorization', `Bearer ${person}`)
      .send({ ...answers, category: 'VISITOR', answers: {} })
      .expect(400);
    expect(missing.body.fields[`answers.${fieldId}`]).toBe('Preencha este campo.');

    const visitor = await http
      .post(`/api/events/${formSlug}/registrations`)
      .set('Authorization', `Bearer ${person}`)
      .send({ ...answers, category: 'VISITOR', answers: { [fieldId]: 'Na escola' } })
      .expect(201);
    expect(visitor.body.passportCode).toEqual(expect.any(String));
  });
});
