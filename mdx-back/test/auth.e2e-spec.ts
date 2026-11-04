import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { TokenService } from '../src/auth/token.service.js';
import { UsersRepository } from '../src/auth/users.repository.js';
import { cpfFromSeed } from '../src/server/form-schema.js';
import type { AuthUser, EventRole } from '../src/server/permissions.js';

const adminRoutes = [
  ['get', '/api/admin/events'],
  ['post', '/api/admin/events'],
  ['get', '/api/admin/events/event-1'],
  ['patch', '/api/admin/events/event-1'],
  ['post', '/api/admin/events/event-1/publish'],
  ['post', '/api/admin/events/event-1/close'],
  ['post', '/api/admin/events/event-1/duplicate'],
  ['post', '/api/admin/events/event-1/locations'],
  ['post', '/api/admin/events/event-1/members'],
  ['post', '/api/admin/events/event-1/activities'],
  ['post', '/api/admin/events/event-1/activities/steam'],
  ['post', '/api/admin/events/event-1/activities/reorder'],
  ['patch', '/api/admin/events/event-1/activities/activity-1'],
  ['post', '/api/admin/events/event-1/activities/activity-1/duplicate'],
  ['post', '/api/admin/events/event-1/form-fields'],
  ['post', '/api/admin/events/event-1/form-fields/reorder'],
  ['post', '/api/admin/events/event-1/form-fields/competitor'],
  ['patch', '/api/admin/events/event-1/form-fields/field-1'],
  ['post', '/api/admin/events/event-1/check-in'],
  ['post', '/api/admin/events/event-1/stamps'],
  ['post', '/api/admin/events/event-1/scores'],
] as const;

describe('Autorização (e2e)', () => {
  let app: INestApplication<App>;
  let tokens: TokenService;
  let users: UsersRepository;
  const email = `auth-e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
    tokens = app.get(TokenService);
    users = app.get(UsersRepository);
  });

  afterAll(async () => {
    await users.deleteByEmail(email);
    await app.close();
  });

  async function bearer(user: AuthUser & { email: string }) {
    return tokens.sign(user);
  }

  it('USER comum recebe 403 em todas as rotas de admin, com o token do login', async () => {
    const password = 'senha-segura-1';
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Pessoa Comum', email, password, cpf: cpfFromSeed(Date.now()) })
      .expect(201);

    expect(registered.body.user.role).toBe('USER');
    expect(registered.body.token).toEqual(expect.any(String));

    const logged = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    for (const [method, path] of adminRoutes) {
      const response = await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${logged.body.token}`);
      expect(response.status, `${method.toUpperCase()} ${path}`).toBe(403);
    }

    await request(app.getHttpServer())
      .patch(`/api/conta/registrations/${logged.body.user.id}`)
      .set('Authorization', `Bearer ${logged.body.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/conta/registrations/outra-pessoa')
      .set('Authorization', `Bearer ${logged.body.token}`)
      .expect(403);
  });

  it('entra com o código enviado ao e-mail cadastrado', async () => {
    const otpEmail = `otp-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Pessoa Código',
        email: otpEmail,
        password: 'senha-segura-1',
        cpf: cpfFromSeed(Date.now() + 3),
      })
      .expect(201);

    const requested = await request(app.getHttpServer())
      .post('/api/auth/otp/request')
      .send({ email: otpEmail })
      .expect(200);

    expect(requested.body.devCode).toMatch(/^\d{6}$/);

    const logged = await request(app.getHttpServer())
      .post('/api/auth/otp/verify')
      .send({ email: otpEmail, code: requested.body.devCode })
      .expect(200);

    expect(logged.body.user.email).toBe(otpEmail);
    expect(logged.body.token).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/auth/otp/verify')
      .send({ email: otpEmail, code: requested.body.devCode })
      .expect(401);

    await users.deleteByEmail(otpEmail);
  });

  it('limita tentativas de login pelo e-mail', async () => {
    const alvo = `limite-${Date.now()}@example.com`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: alvo, password: 'senha-errada-1' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: alvo, password: 'senha-errada-1' })
      .expect(429);
  });

  it.each([
    ['ORGANIZER', 'patch', '/api/admin/events/event-1', 200],
    ['ORGANIZER', 'patch', '/api/admin/events/event-2', 403],
    ['ORGANIZER', 'post', '/api/admin/events/event-1/stamps', 403],
    ['ORGANIZER', 'post', '/api/admin/events/event-1/scores', 403],
    ['STAFF', 'post', '/api/admin/events/event-1/check-in', 200],
    ['STAFF', 'post', '/api/admin/events/event-1/stamps', 200],
    ['STAFF', 'patch', '/api/admin/events/event-1', 403],
    ['STAFF', 'post', '/api/admin/events/event-1/scores', 403],
    ['MONITOR', 'post', '/api/admin/events/event-1/stamps', 200],
    ['MONITOR', 'post', '/api/admin/events/event-1/scores', 403],
    ['MONITOR', 'patch', '/api/admin/events/event-1', 403],
    ['JUDGE', 'post', '/api/admin/events/event-1/scores', 200],
    ['JUDGE', 'post', '/api/admin/events/event-1/stamps', 403],
    ['JUDGE', 'post', '/api/admin/events/event-1/check-in', 403],
    ['JUDGE', 'patch', '/api/admin/events/event-1', 403],
    ['ADMIN', 'patch', '/api/admin/events/event-2', 200],
    ['ADMIN', 'post', '/api/admin/events/event-2/stamps', 200],
    ['ADMIN', 'post', '/api/admin/events/event-2/scores', 200],
  ] as const)(
    '%s em %s %s responde %s',
    async (role, method, path, status) => {
      const eventRole = role === 'ADMIN' ? null : (role as EventRole);
      const user: AuthUser & { email: string } = {
        id: `${role.toLowerCase()}-1`,
        email: `${role.toLowerCase()}@example.com`,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
        memberships: eventRole ? [{ eventId: 'event-1', role: eventRole }] : [],
      };
      const token = await bearer(user);
      const response = await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(status);
    },
  );

  it('recusa token inválido com 401', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/events')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);

    await request(app.getHttpServer()).get('/api/admin/events').expect(401);
  });
});
