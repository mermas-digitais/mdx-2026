import { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service.js';

const { send, options } = vi.hoisted(() => ({ send: vi.fn(), options: vi.fn() }));
vi.mock('@aws-sdk/client-s3', async (original) => ({
  ...(await original<typeof import('@aws-sdk/client-s3')>()),
  S3Client: class {
    constructor(config: unknown) { options(config); }
    send = send;
    destroy() {}
  },
}));

describe('StorageService', () => {
  let storage: StorageService;
  beforeEach(() => {
    vi.clearAllMocks();
    storage = new StorageService(new ConfigService({
      S3_ENDPOINT: 'https://s3.example.com', S3_REGION: 'garage', S3_BUCKET: 'mdx26',
      S3_ACCESS_KEY_ID: 'test-key', S3_SECRET_ACCESS_KEY: 'test-secret',
    }));
  });

  it('usa path-style e checksums compatíveis com Garage', () => {
    expect(options).toHaveBeenCalledWith(expect.objectContaining({
      forcePathStyle: true, region: 'garage', requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }));
  });

  it('envia bytes e tipo sem tornar o objeto público', async () => {
    send.mockResolvedValue({});
    const body = Buffer.from('image');
    await storage.put('banner.png', body, 'image/png');
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'mdx26', Key: 'banner.png', Body: body, ContentType: 'image/png',
    });
  });

  it('retorna stream do objeto privado', async () => {
    const body = Readable.from(Buffer.from('pdf'));
    send.mockResolvedValue({ Body: body });
    expect(await storage.get('documents/file.pdf')).toBe(body);
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
  });

  it('traduz apenas objeto ausente para 404', async () => {
    send.mockRejectedValue({ name: 'NoSuchKey' });
    await expect(storage.get('missing')).rejects.toMatchObject({ status: 404 });
    const outage = new Error('Garage offline');
    send.mockRejectedValue(outage);
    await expect(storage.get('file')).rejects.toBe(outage);
  });

  it('remove o objeto no bucket configurado', async () => {
    send.mockResolvedValue({});
    await storage.delete('documents/file.pdf');
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'mdx26', Key: 'documents/file.pdf' });
  });
});
