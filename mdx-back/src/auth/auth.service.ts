import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { cpfDigits, cpfError } from '../server/form-schema.js';
import type { AuthUser } from '../server/permissions.js';
import { LoginCodesRepository } from './login-codes.repository.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { MailerService } from './mailer.service.js';
import { TokenService } from './token.service.js';
import { UsersRepository } from './users.repository.js';

const HASH_ROUNDS = 12;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_WAIT_MS = 45 * 1000;
const MAX_CODE_ATTEMPTS = 5;

export type AuthSession = {
  token: string;
  user: AuthUser & { name: string; email: string };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
    private readonly limiter: LoginRateLimiter,
    private readonly codes: LoginCodesRepository,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(email: string): Promise<{ sent: true; cooldown?: true; devCode?: string }> {
    const normalized = email.trim().toLowerCase();
    this.limiter.assertAllowed(normalized);
    const stored = await this.users.findByEmail(normalized);
    if (!stored) {
      this.limiter.recordFailure(normalized);
      throw new NotFoundException('Não encontramos uma conta com esse e-mail.');
    }

    const current = await this.codes.latest(normalized);
    if (current && Date.now() - current.createdAt.getTime() < RESEND_WAIT_MS) {
      return { sent: true, cooldown: true };
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.codes.issue(normalized, this.hashCode(code), new Date(Date.now() + CODE_TTL_MS));
    const delivered = await this.mailer.sendLoginCode(normalized, code);
    if (!delivered && this.config.get('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException('Não foi possível enviar o e-mail agora.');
    }

    return {
      sent: true,
      ...(delivered ? {} : { devCode: code }),
    };
  }

  async startOtp(email: string): Promise<{ sent: true; cooldown?: true; devCode?: string }> {
    const normalized = email.trim().toLowerCase();
    this.limiter.assertAllowed(normalized);
    const current = await this.codes.latest(normalized);
    if (current && Date.now() - current.createdAt.getTime() < RESEND_WAIT_MS) {
      return { sent: true, cooldown: true };
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.codes.issue(normalized, this.hashCode(code), new Date(Date.now() + CODE_TTL_MS));
    const delivered = await this.mailer.sendLoginCode(normalized, code);
    if (!delivered && this.config.get('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException('Não foi possível enviar o e-mail agora.');
    }
    return { sent: true, ...(delivered ? {} : { devCode: code }) };
  }

  async confirmOtp(email: string, code: string): Promise<AuthSession | { verified: true; email: string; proof: string }> {
    const normalized = email.trim().toLowerCase();
    await this.assertCode(normalized, code);
    const stored = await this.users.findByEmail(normalized);
    if (!stored) {
      return { verified: true, email: normalized, proof: await this.tokens.signEmailProof(normalized) };
    }
    return this.sessionFor(stored);
  }

  async cpfStatus(
    cpf: string,
    email?: string,
  ): Promise<{ available: true } | { available: false; message: string }> {
    const digits = cpfDigits(cpf);
    if (cpfError(digits)) return { available: false, message: 'Informe um CPF válido.' };
    const normalized = email?.trim().toLowerCase();
    const [owner, account] = await Promise.all([
      this.users.findByCpf(digits),
      normalized ? this.users.findByEmail(normalized) : Promise.resolve(null),
    ]);
    if (account?.cpf && account.cpf !== digits) {
      return { available: false, message: 'O CPF da conta é outro.' };
    }
    if (owner && owner.email !== normalized) {
      return { available: false, message: 'Já existe uma conta com esse CPF.' };
    }
    return { available: true };
  }

  async registerFromProof(input: { proof: string; name: string; cpf: string }): Promise<AuthSession> {
    let email: string;
    try {
      email = await this.tokens.verifyEmailProof(input.proof);
    } catch {
      throw new UnauthorizedException('Confirme o e-mail de novo.');
    }
    const existing = await this.users.findByEmail(email);
    if (existing) return this.sessionFor(existing);
    const cpf = cpfDigits(input.cpf);
    if (cpfError(cpf)) throw new BadRequestException('Informe um CPF válido.');
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('base64url'), HASH_ROUNDS);
    try {
      const created = await this.users.create({
        name: input.name.trim(),
        email,
        cpf,
        passwordHash,
      });
      await this.users.linkByCpf(created.id, cpf);
      return this.sessionFor(created);
    } catch (error) {
      const constraint = uniqueConstraint(error);
      if (constraint === 'users_cpf_key') throw new ConflictException('Já existe uma conta com esse CPF.');
      if (constraint === 'users_email_key') {
        const again = await this.users.findByEmail(email);
        if (again) return this.sessionFor(again);
      }
      throw error;
    }
  }

  async adoptSession(token: string): Promise<AuthSession> {
    let verified: { id: string };
    try {
      verified = await this.tokens.verify(token);
    } catch {
      throw new UnauthorizedException('Faça login para continuar.');
    }
    const stored = await this.users.findById(verified.id);
    if (!stored) throw new UnauthorizedException('Faça login para continuar.');
    return this.sessionFor(stored);
  }

  async verifyOtp(email: string, code: string): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    this.limiter.assertAllowed(normalized);
    const stored = await this.users.findByEmail(normalized);
    const active = stored ? await this.codes.latest(normalized) : null;
    const fresh =
      active !== null &&
      active.attempts < MAX_CODE_ATTEMPTS &&
      active.expiresAt.getTime() > Date.now();
    const matches = fresh && active !== null && safeEqual(active.codeHash, this.hashCode(code));

    if (!stored || !active || !matches) {
      if (active && active.attempts < MAX_CODE_ATTEMPTS) {
        await this.codes.bumpAttempts(active.id);
      }
      this.limiter.recordFailure(normalized);
      throw new UnauthorizedException('Código incorreto ou vencido.');
    }

    await this.codes.consume(active.id);
    this.limiter.recordSuccess(normalized);
    return this.sessionFor(stored);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    this.limiter.assertAllowed(normalized);
    const stored = await this.users.findByEmail(normalized);
    const passwordOk = stored
      ? await bcrypt.compare(password, stored.passwordHash)
      : false;

    if (!stored || !passwordOk) {
      this.limiter.recordFailure(normalized);
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    this.limiter.recordSuccess(normalized);
    return this.sessionFor(stored);
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
    cpf: string;
  }): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const cpf = cpfDigits(input.cpf);
    if (cpfError(cpf)) throw new BadRequestException('Informe um CPF válido.');
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Já existe uma conta com esse e-mail.');
    }

    const passwordHash = await bcrypt.hash(input.password, HASH_ROUNDS);
    try {
      const created = await this.users.create({
        name: input.name.trim(),
        email,
        cpf,
        passwordHash,
      });
      await this.users.linkByCpf(created.id, cpf);
      return this.sessionFor(created);
    } catch (error) {
      const constraint = uniqueConstraint(error);
      if (constraint === 'users_cpf_key') {
        throw new ConflictException('Já existe uma conta com esse CPF.');
      }
      if (constraint === 'users_email_key') {
        throw new ConflictException('Já existe uma conta com esse e-mail.');
      }
      throw error;
    }
  }

  async panelLogin(password: string): Promise<AuthSession> {
    const key = 'panel-login';
    this.limiter.assertAllowed(key);
    const expected = this.config.get<string>('ADMIN_PANEL_PASSWORD') || 'adminMDX26';
    if (!sameSecret(password, expected)) {
      this.limiter.recordFailure(key);
      throw new UnauthorizedException('Senha incorreta.');
    }
    this.limiter.recordSuccess(key);
    const admin = await this.users.findAdmin();
    if (admin) return this.sessionFor(admin);
    const panelUser = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Painel',
      email: 'painel@mdx.local',
      role: 'ADMIN' as const,
      memberships: [],
    };
    return { token: await this.tokens.sign(panelUser), user: panelUser };
  }

  async profile(userId: string): Promise<{ id: string; name: string; email: string; cpf: string | null }> {
    const stored = await this.users.findById(userId);
    if (!stored) throw new UnauthorizedException('Faça login para continuar.');
    return { id: stored.id, name: stored.name, email: stored.email, cpf: stored.cpf };
  }

  private async assertCode(email: string, code: string): Promise<void> {
    this.limiter.assertAllowed(email);
    const active = await this.codes.latest(email);
    const fresh =
      active !== null &&
      active.attempts < MAX_CODE_ATTEMPTS &&
      active.expiresAt.getTime() > Date.now();
    const matches = fresh && active !== null && safeEqual(active.codeHash, this.hashCode(code));
    if (!active || !matches) {
      if (active && active.attempts < MAX_CODE_ATTEMPTS) await this.codes.bumpAttempts(active.id);
      this.limiter.recordFailure(email);
      throw new UnauthorizedException('Código incorreto ou vencido.');
    }
    await this.codes.consume(active.id);
    this.limiter.recordSuccess(email);
  }

  private hashCode(code: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(code)
      .digest('hex');
  }

  private async sessionFor(stored: {
    id: string;
    name: string;
    email: string;
    role: AuthUser['role'];
  }): Promise<AuthSession> {
    const user: AuthUser & { name: string; email: string } = {
      id: stored.id,
      name: stored.name,
      email: stored.email,
      role: stored.role,
      memberships: await this.users.memberships(stored.id),
    };
    return { token: await this.tokens.sign(user), user };
  }
}

function sameSecret(given: string, expected: string): boolean {
  const left = createHash('sha256').update(given).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
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
