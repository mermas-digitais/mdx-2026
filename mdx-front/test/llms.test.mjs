import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = ['llms.txt', 'llms-full.txt'];

for (const name of files) {
  test(`${name} existe, aponta para a página oficial e não repete fatos de 2025`, async () => {
    const text = await readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');
    assert.match(text, /^# /, 'precisa de título Markdown');
    assert.match(text, /https:\/\/mdx26\.mermasdigitais\.com\.br\/e\/mdx-2026/);
    assert.match(text, /24 e 25 de novembro de 2026/);
    assert.doesNotMatch(text, /2025/);
  });
}
