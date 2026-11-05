import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { eventMetadata } from '../src/lib/event-metadata.ts';

const authUrl = process.env.AUTH_URL;
afterEach(() => {
  if (authUrl === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = authUrl;
});
const event = {
  slug: 'mdx-2026', title: 'MDX 2026', description: '  Meninas na tecnologia.\n Inscrições abertas. ',
  theme: 'STEAM', preview: false,
};

test('compartilha MDX com arte dedicada, URL canônica e Twitter Card grande', () => {
  process.env.AUTH_URL = 'https://mdx26.fabitz.com.br';
  const meta = eventMetadata(event, 'https://api.example.com/old-banner.png');
  assert.equal(meta.alternates.canonical, 'https://mdx26.fabitz.com.br/e/mdx-2026');
  assert.equal(meta.openGraph.url, meta.alternates.canonical);
  assert.equal(meta.openGraph.title, 'MDX STEAM 2026');
  assert.equal(meta.description, 'Meninas na tecnologia. Inscrições abertas.');
  assert.deepEqual(meta.openGraph.images, [{
    url: 'https://mdx26.fabitz.com.br/social/mdx-2026-og.jpg', width: 1200, height: 630,
    type: 'image/jpeg', alt: 'MDX STEAM 2026 — inscrições abertas até 20 de novembro.',
  }]);
  assert.equal(meta.twitter.card, 'summary_large_image');
  assert.deepEqual(meta.twitter.images, meta.openGraph.images);
  assert.equal(meta.robots.index, true);
});

test('preserva imagem e título de outros eventos e não indexa prévia', () => {
  process.env.AUTH_URL = 'https://events.example.com';
  const meta = eventMetadata({ ...event, slug: 'outro-evento', title: 'Outro evento', preview: true }, 'https://api.example.com/banner.jpg');
  assert.equal(meta.openGraph.title, 'Outro evento');
  assert.equal(meta.openGraph.images[0].url, 'https://api.example.com/banner.jpg');
  assert.deepEqual(meta.robots, { index: false, follow: false });
});

test('usa domínio público sem AUTH_URL e fallback de descrição, sem imagem inexistente', () => {
  delete process.env.AUTH_URL;
  const meta = eventMetadata({ ...event, slug: 'outro', description: '', theme: '' }, null);
  assert.equal(meta.alternates.canonical, 'https://mdx26.fabitz.com.br/e/outro');
  assert.equal(meta.description, 'Página do evento MDX 2026.');
  assert.equal(meta.openGraph.images, undefined);
  assert.equal(meta.twitter.images, undefined);
});
