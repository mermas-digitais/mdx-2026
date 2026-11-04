import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      PORT: '3001',
      DATABASE_URL: 'postgresql://mdx:mdx@localhost:5432/mdx',
      FRONTEND_URL: 'http://localhost:3000',
      JWT_SECRET: 'dev-only-change-me-please-32chars',
      S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:3900',
      S3_REGION: process.env.S3_REGION ?? 'garage',
      S3_BUCKET: process.env.S3_BUCKET ?? 'mdx26-test',
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? 'test',
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? 'test',
    },
  },
});
