import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { encode } from 'next-auth/jwt';
import { readSessionToken } from '../src/lib/session-token.ts';

const original = { AUTH_URL: process.env.AUTH_URL, AUTH_SECRET: process.env.AUTH_SECRET };
afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

for (const secure of [false, true]) {
  test(`lê sessão ${secure ? 'HTTPS' : 'HTTP'} e recupera token da API`, async () => {
    process.env.AUTH_URL = secure ? 'https://mdx.example.com' : 'http://localhost:3000';
    process.env.AUTH_SECRET = 'test-secret-longer-than-32-characters';
    const name = `${secure ? '__Secure-' : ''}authjs.session-token`;
    const jwt = await encode({ secret: process.env.AUTH_SECRET, salt: name, token: { apiToken: 'backend-token' } });
    const token = await readSessionToken(`${name}=${jwt}`);
    assert.equal(token?.apiToken, 'backend-token');
  });
}

test('não aceita cookie ausente ou inválido', async () => {
  process.env.AUTH_SECRET = 'test-secret-longer-than-32-characters';
  assert.equal(await readSessionToken(''), null);
  assert.equal(await readSessionToken('authjs.session-token=invalid'), null);
});
