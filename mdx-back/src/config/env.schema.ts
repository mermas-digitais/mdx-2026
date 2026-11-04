import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

const optionalPort = z.preprocess(
  (value) => (value === undefined || value === '' ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.url().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default('garage'),
  S3_BUCKET: z.string().min(1).default('mdx26'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  SMTP_HOST: optionalText,
  SMTP_PORT: optionalPort,
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  SMTP_FROM: optionalText,
  MAIL_FROM: optionalText,
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && (!env.SMTP_HOST || !(env.SMTP_FROM || env.MAIL_FROM))) {
    ctx.addIssue({ code: 'custom', message: 'Produção exige SMTP_HOST e SMTP_FROM (ou MAIL_FROM).', path: ['SMTP_HOST'] });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Variáveis de ambiente inválidas: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
