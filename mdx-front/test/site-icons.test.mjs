import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

test('ícones de marca incluem favicon multirresolução e Apple Touch', async () => {
  const ico = await readFile(new URL('../src/app/favicon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1);
  const sizes = [];
  for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const entry = 6 + i * 16;
    const offset = ico.readUInt32LE(entry + 12);
    const length = ico.readUInt32LE(entry + 8);
    const image = await sharp(ico.subarray(offset, offset + length)).metadata();
    sizes.push(image.width);
    assert.equal(image.width, image.height);
  }
  assert.deepEqual(sizes, [16, 32, 48]);
  for (const [file, size] of [['icon.png', 192], ['apple-icon.png', 180]]) {
    const image = await sharp(await readFile(new URL(`../src/app/${file}`, import.meta.url))).metadata();
    assert.equal(image.width, size);
    assert.equal(image.height, size);
    assert.equal(image.format, 'png');
  }
});
