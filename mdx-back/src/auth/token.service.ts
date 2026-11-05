import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import {
  eventRoles,
  globalRoles,
  type AuthUser,
  type EventRole,
  type GlobalRole,
  type Membership,
} from '../server/permissions.js';

type TokenUser = AuthUser & { email: string };

@Injectable()
export class TokenService {
  private readonly secret: Uint8Array;

  constructor(config: ConfigService) {
    this.secret = new TextEncoder().encode(
      config.getOrThrow<string>('JWT_SECRET'),
    );
  }

  sign(user: TokenUser): Promise<string> {
    return new SignJWT({
      email: user.email,
      role: user.role,
      memberships: user.memberships,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(this.secret);
  }

  signEmailProof(email: string): Promise<string> {
    return new SignJWT({ purpose: 'email-proof', email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(email)
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(this.secret);
  }

  async verifyEmailProof(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, this.secret);
    if (payload.purpose !== 'email-proof' || typeof payload.email !== 'string') {
      throw new Error('Token inválido');
    }
    return payload.email;
  }

  async verify(token: string): Promise<TokenUser> {
    const { payload } = await jwtVerify(token, this.secret);
    const id = payload.sub;
    const email = payload.email;
    const role = payload.role;
    if (typeof id !== 'string' || typeof email !== 'string' || !isGlobalRole(role)) {
      throw new Error('Token inválido');
    }

    return {
      id,
      email,
      role,
      memberships: membershipsFrom(payload.memberships),
    };
  }
}

function isGlobalRole(value: unknown): value is GlobalRole {
  return globalRoles.includes(value as GlobalRole);
}

function isEventRole(value: unknown): value is EventRole {
  return eventRoles.includes(value as EventRole);
}

function membershipsFrom(value: unknown): Membership[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const eventId = 'eventId' in item ? item.eventId : undefined;
    const role = 'role' in item ? item.role : undefined;
    if (typeof eventId !== 'string' || !isEventRole(role)) return [];
    return [{ eventId, role }];
  });
}
