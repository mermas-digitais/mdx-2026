import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../dist/storage/storage.service.js';

const storage = new StorageService(new ConfigService(process.env));
const key = `smoke/${randomUUID()}.txt`;
const body = Buffer.from('MDX Garage storage smoke test');
try {
  await storage.put(key, body, 'text/plain');
  const stream = await storage.get(key);
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  assert.deepEqual(Buffer.concat(chunks), body);
  const anonymous = await fetch(`${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(anonymous.status, 403, 'Objeto não pode ser acessível sem credenciais');
  await storage.delete(key);
  await assert.rejects(storage.get(key), (error) => error.status === 404);
  console.log('Garage OK: upload, leitura, acesso anônimo bloqueado e exclusão.');
} finally {
  try { await storage.delete(key); } finally { storage.onModuleDestroy(); }
}
