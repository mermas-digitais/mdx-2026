import { Readable } from 'node:stream';
import { EventsService, uploadKey } from './events.service.js';
import { RoboticsService, documentKey } from './robotics.service.js';
import { UploadsController } from './events.controller.js';
import type { EventsRepository } from './events.repository.js';
import type { RoboticsRepository } from './robotics.repository.js';
import type { StorageService } from '../storage/storage.service.js';
import { cpfFromSeed } from '../server/form-schema.js';

const id = '11111111-1111-4111-8111-111111111111';
const user = { id: 'advisor', role: 'USER' as const, memberships: [] };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function setup() {
  const events = {
    findById: vi.fn().mockResolvedValue({ id, banner: null }),
    findPublicBySlug: vi.fn().mockResolvedValue({ id, status: 'PUBLISHED', registrationsOpen: true }),
    update: vi.fn().mockResolvedValue(undefined), bannerInUse: vi.fn().mockResolvedValue(false),
  };
  const robotics = {
    documentOf: vi.fn().mockResolvedValue({ eventId: id, advisorUserId: user.id, stored: `documents/${id}.pdf` }),
    cpfOf: vi.fn().mockResolvedValue(cpfFromSeed(42)), assignCpf: vi.fn().mockResolvedValue('ok'),
    createTeam: vi.fn().mockRejectedValue(new Error('database failed')),
  };
  const storage = { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(Readable.from(png)) };
  const service = new EventsService(events as unknown as EventsRepository, robotics as unknown as RoboticsRepository, storage as unknown as StorageService);
  const teams = new RoboticsService(events as unknown as EventsRepository, robotics as unknown as RoboticsRepository, storage as unknown as StorageService);
  return { events, robotics, storage, service, teams };
}

it('não permite traversal nem documentos na rota pública de banners', async () => {
  const { storage } = setup();
  const controller = new UploadsController(storage as unknown as StorageService);
  for (const name of ['../secret.png', `documents/${id}.pdf`, `${id}.pdf`]) {
    await expect(controller.file(name)).rejects.toMatchObject({ status: 404 });
  }
  expect(storage.get).not.toHaveBeenCalled();
  expect(uploadKey(`${id}.png`)).toBe(`${id}.png`);
  expect(documentKey(`documents/${id}.pdf`)).toBe(`documents/${id}.pdf`);
  expect(documentKey(`documents/../${id}.pdf`)).toBeNull();
});

it('não acessa S3 antes de autorizar o documento', async () => {
  const { teams, storage } = setup();
  await expect(teams.document('mdx', id, id, { ...user, id: 'other' })).rejects.toMatchObject({ status: 404 });
  expect(storage.get).not.toHaveBeenCalled();
  const file = await teams.document('mdx', id, id, user);
  expect(file.type).toBe('application/pdf');
  expect(storage.get).toHaveBeenCalledWith(`documents/${id}.pdf`);
});

it('remove banner novo se a gravação no banco falhar', async () => {
  const { service, events, storage } = setup();
  events.update.mockRejectedValue(new Error('database failed'));
  await expect(service.saveBanner(user, id, { mimetype: 'image/png', size: png.length, buffer: png })).rejects.toThrow('database failed');
  expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
});

it('preserva banner compartilhado por evento duplicado', async () => {
  const { service, events, storage } = setup();
  events.findById.mockResolvedValue({ id, banner: `/api/uploads/${id}.png` });
  events.bannerInUse.mockResolvedValue(true);
  vi.spyOn(service, 'detail').mockResolvedValue({} as never);
  await service.saveBanner(user, id, { mimetype: 'image/png', size: png.length, buffer: png });
  expect(storage.delete).not.toHaveBeenCalled();
});

it('limpa todos os documentos após rejeição do banco', async () => {
  const { teams, storage } = setup();
  const members = [0, 1, 2].map((index) => ({ fullName: `Aluna ${index}`, cpf: cpfFromSeed(1000 + index), birthDate: '2012-04-03' }));
  const payload = { advisorName: 'Ana Orientadora', advisorEmail: 'ana@escola.br', advisorPhone: '99999999999', institution: 'IFMA', teamName: 'Íris', modalityIds: [id], members, girlsDeclaration: true, rulesAccepted: true };
  const files = ['advisorDocument', 'memberDocument0', 'memberDocument1', 'memberDocument2'].map((fieldname) => ({ fieldname, mimetype: 'image/png', size: png.length, buffer: png }));
  await expect(teams.createTeam('mdx', payload, files, user)).rejects.toThrow('database failed');
  expect(storage.put).toHaveBeenCalledTimes(4);
  expect(storage.delete.mock.calls.map(([key]) => key)).toEqual(storage.put.mock.calls.map(([key]) => key));
});
