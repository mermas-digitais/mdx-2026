import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import path from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { cpfDigits, cpfError, formIssues } from '../server/form-schema.js';
import { roboticsTeamSchema } from '../server/robotics-schema.js';
import { canManageEvent, type AuthUser } from '../server/permissions.js';
import { EventsRepository } from './events.repository.js';
import {
  RoboticsRejected,
  RoboticsRepository,
  type RoboticsTeamView,
} from './robotics.repository.js';
import { StorageService } from '../storage/storage.service.js';

const DOCUMENT_MAX = 5 * 1024 * 1024;

export type IncomingFile = {
  fieldname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type StoredDocument = {
  stream: Readable;
  type: string;
  filename: string;
};

@Injectable()
export class RoboticsService {
  private readonly logger = new Logger(RoboticsService.name);
  constructor(
    private readonly events: EventsRepository,
    private readonly robotics: RoboticsRepository,
    private readonly storage: StorageService,
  ) {}

  async createTeam(
    slug: string,
    payload: unknown,
    files: IncomingFile[],
    user: AuthUser,
  ): Promise<RoboticsTeamView> {
    const event = await this.openEvent(slug);
    const parsed = roboticsTeamSchema.safeParse(parsePayload(payload));
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Revise os campos.',
        fields: formIssues(parsed.error),
      });
    }
    const data = parsed.data;
    const advisorCpf = await this.advisorCpf(user.id, data.advisorCpf);
    const memberCpfs = data.members.map((member) => cpfDigits(member.cpf));
    if (memberCpfs.includes(advisorCpf)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Revise os campos.',
        fields: { members: 'O CPF do orientador não entra como integrante.' },
      });
    }

    const advisorFile = files.find((file) => file.fieldname === 'advisorDocument');
    const memberFiles = data.members.map((_, index) =>
      files.find((file) => file.fieldname === `memberDocument${index}`),
    );
    const fileFields: Record<string, string> = {};
    const advisorKind = advisorFile ? documentKind(advisorFile.buffer) : null;
    if (!advisorFile || !advisorKind) {
      fileFields.advisorDocument = 'Envie o documento de vínculo em PDF ou imagem, até 5 MB.';
    }
    memberFiles.forEach((file, index) => {
      if (!file || !documentKind(file.buffer)) {
        fileFields[`members.${index}.document`] =
          'Envie o documento de vínculo em PDF ou imagem, até 5 MB.';
      }
    });
    if (Object.keys(fileFields).length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Revise os campos.',
        fields: fileFields,
      });
    }

    const written: string[] = [];
    try {
      const advisorDocument = await this.storeDocument(advisorFile!.buffer, written);
      const members = [];
      // Aguarda cada envio para que o rollback não concorra com uploads ainda ativos.
      for (const [index, member] of data.members.entries()) {
        members.push({
          fullName: member.fullName,
          cpf: memberCpfs[index],
          birthDate: member.birthDate,
          document: await this.storeDocument(memberFiles[index]!.buffer, written),
        });
      }
      return await this.robotics.createTeam({
        eventId: event.id,
        advisorUserId: user.id,
        name: data.teamName,
        institution: data.institution,
        advisorName: data.advisorName,
        advisorEmail: data.advisorEmail,
        advisorPhone: data.advisorPhone,
        advisorDocument,
        members,
        modalityIds: data.modalityIds,
      });
    } catch (error) {
      const cleanup = await Promise.allSettled(written.map((key) => this.storage.delete(key)));
      if (cleanup.some((result) => result.status === 'rejected')) this.logger.warn('Falha ao limpar documentos órfãos.');
      if (error instanceof RoboticsRejected) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Revise os campos.',
          fields: error.fields,
        });
      }
      throw error;
    }
  }

  async mine(slug: string, user: AuthUser): Promise<RoboticsTeamView[]> {
    const event = await this.visibleEvent(slug);
    return this.robotics.teamsForAdvisor(event.id, user.id);
  }

  async list(eventId: string): Promise<RoboticsTeamView[]> {
    await this.requireEvent(eventId);
    return this.robotics.teamsForEvent(eventId);
  }

  async withdraw(slug: string, teamId: string, user: AuthUser): Promise<RoboticsTeamView> {
    const event = await this.openEvent(slug);
    const removed = await this.robotics.withdraw(event.id, teamId, user.id);
    if (!removed) throw new NotFoundException('Equipe não encontrada.');
    const team = await this.robotics.teamById(teamId);
    if (!team) throw new NotFoundException('Equipe não encontrada.');
    return team;
  }

  async document(slug: string, teamId: string, documentId: string, user: AuthUser): Promise<StoredDocument> {
    const event = await this.visibleEvent(slug);
    const found = await this.robotics.documentOf(teamId, documentId);
    if (!found || found.eventId !== event.id) throw new NotFoundException('Documento não encontrado.');
    if (found.advisorUserId !== user.id && !canManageEvent(user, event.id)) {
      throw new NotFoundException('Documento não encontrado.');
    }
    const key = documentKey(found.stored);
    if (!key) throw new NotFoundException('Documento não encontrado.');
    const extension = path.extname(key).slice(1).toLowerCase();
    return {
      stream: await this.storage.get(key),
      type: extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg',
      filename: `vinculo.${extension}`,
    };
  }

  private async storeDocument(buffer: Buffer, written: string[]): Promise<string> {
    const kind = documentKind(buffer);
    if (!kind) throw new BadRequestException('Envie o documento em PDF ou imagem, até 5 MB.');
    const key = `documents/${randomUUID()}.${kind}`;
    const type = kind === 'pdf' ? 'application/pdf' : kind === 'jpg' ? 'image/jpeg' : `image/${kind}`;
    await this.storage.put(key, buffer, type);
    written.push(key);
    return key;
  }

  private async advisorCpf(userId: string, informed: string | undefined): Promise<string> {
    const current = await this.robotics.cpfOf(userId);
    const digits = informed ? cpfDigits(informed) : current;
    if (!digits || cpfError(digits)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Revise os campos.',
        fields: { advisorCpf: 'Informe um CPF válido.' },
      });
    }
    const saved = await this.robotics.assignCpf(userId, digits);
    if (saved === 'mismatch') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Revise os campos.',
        fields: { advisorCpf: 'O CPF da conta é outro.' },
      });
    }
    if (saved === 'taken') {
      throw new ConflictException('Já existe uma conta com esse CPF.');
    }
    return digits;
  }

  private async openEvent(slug: string) {
    const event = await this.visibleEvent(slug);
    if (event.status !== 'PUBLISHED' || !event.registrationsOpen) {
      throw new BadRequestException('As inscrições deste evento estão encerradas.');
    }
    return event;
  }

  private async visibleEvent(slug: string) {
    const event = await this.events.findPublicBySlug(slug);
    if (!event || (event.status !== 'PUBLISHED' && event.status !== 'CLOSED')) {
      throw new NotFoundException('Evento não encontrado.');
    }
    return event;
  }

  private async requireEvent(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundException('Evento não encontrado.');
    return event;
  }
}

function parsePayload(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return payload;
  }
}

function documentKind(buffer: Buffer): 'pdf' | 'jpg' | 'png' | 'webp' | null {
  if (buffer.length < 12 || buffer.length > DOCUMENT_MAX) return null;
  if (buffer.subarray(0, 5).toString('utf8') === '%PDF-') return 'pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer.subarray(0, 4).toString('utf8') === 'RIFF' && buffer.subarray(8, 12).toString('utf8') === 'WEBP') {
    return 'webp';
  }
  return null;
}

export function documentKey(stored: string): string | null {
  if (!/^documents\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i.test(stored)) return null;
  return stored;
}
