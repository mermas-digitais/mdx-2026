import { validateEnv } from './env.schema.js';

const base = {
  DATABASE_URL: 'postgresql://mdx:mdx@localhost:5432/mdx',
  JWT_SECRET: 'test-secret-longer-than-32-characters',
  S3_ENDPOINT: 'https://s3.example.com', S3_REGION: 'garage', S3_BUCKET: 'mdx26',
  S3_ACCESS_KEY_ID: 'test', S3_SECRET_ACCESS_KEY: 'test-secret',
};

it('exige storage configurado', () => {
  expect(() => validateEnv({ ...base, S3_ACCESS_KEY_ID: '' })).toThrow();
});

it('exige SMTP e remetente em produção', () => {
  expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow();
  expect(() => validateEnv({
    ...base, NODE_ENV: 'production', SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'mdx@example.com',
  })).not.toThrow();
});

it('aceita MAIL_FROM alternativo e normaliza opcionais vazios', () => {
  const env = validateEnv({ ...base, SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '   ' });
  expect(env.SMTP_HOST).toBeUndefined();
  expect(env.SMTP_PORT).toBeUndefined();
  expect(env.SMTP_USER).toBeUndefined();
  expect(() => validateEnv({ ...base, NODE_ENV: 'production', SMTP_HOST: 'smtp.example.com', MAIL_FROM: 'mdx@example.com', SMTP_PORT: 465 })).not.toThrow();
});
