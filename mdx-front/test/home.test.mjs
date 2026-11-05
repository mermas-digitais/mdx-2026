import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server.js';
import nextConfig from '../next.config.ts';

test('home redireciona para o evento e preserva parâmetros de campanha', async () => {
  const response = await unstable_getResponseFromNextConfig({
    url: 'https://mdx26.example.com/?utm_source=teste', nextConfig,
  });
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://mdx26.example.com/e/mdx-2026?utm_source=teste');
});

test('não redireciona o evento nem o healthcheck', async () => {
  for (const path of ['/e/mdx-2026', '/api/health']) {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://mdx26.example.com${path}`, nextConfig,
    });
    assert.equal(response.headers.get('location'), null);
  }
});

test('redireciona o host antigo para o oficial preservando caminho e campanha', async () => {
  const response = await unstable_getResponseFromNextConfig({
    url: 'https://mdx26.fabitz.com.br/e/mdx-2026?utm_source=antigo', nextConfig,
  });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://mdx26.mermasdigitais.com.br/e/mdx-2026?utm_source=antigo');
});
