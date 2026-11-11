import {
  Body,
  Catch,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, PermissionGuard, RequirePermission } from '../auth/auth.guard.js';
import { BANNER_MAX_BYTES } from '../server/event-schema.js';
import {
  canAccessAdmin,
  canCreateEvent,
  canManageEvent,
  type AuthUser,
} from '../server/permissions.js';
import { EventsService, uploadKey } from './events.service.js';
import { RoboticsService, type IncomingFile } from './robotics.service.js';
import { StorageService } from '../storage/storage.service.js';

type AuthedRequest = { user: AuthUser };

type Upload = { mimetype: string; size: number; buffer: Buffer };

type HttpReply = {
  status(code: number): { json(body: unknown): void };
};

@Catch()
class BannerExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<HttpReply>();
    if (isFileTooLarge(exception)) {
      response.status(400).json({
        statusCode: 400,
        message: 'A imagem pode ter no máximo 2 MB.',
      });
      return;
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const status = exception.getStatus();
      response
        .status(status)
        .json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }
    response.status(500).json({
      statusCode: 500,
      message: 'Não foi possível enviar a imagem.',
    });
  }
}

const manage = RequirePermission((user, request) =>
  canManageEvent(user, request.params.eventId ?? ''),
);

@Controller('admin/events')
@UseGuards(AuthGuard, PermissionGuard)
export class AdminEventsController {
  constructor(
    private readonly events: EventsService,
    private readonly robotics: RoboticsService,
  ) {}

  @Get()
  @RequirePermission((user) => canAccessAdmin(user))
  list(@Req() request: AuthedRequest) {
    return this.events.list(request.user);
  }

  @Get(':eventId/inscriptions')
  @RequirePermission((user) => canAccessAdmin(user))
  inscriptions(@Param('eventId') eventId: string) {
    return this.events.inscriptions(eventId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission((user) => canCreateEvent(user))
  create(@Body() body: unknown) {
    return this.events.create(body);
  }

  @Get(':eventId')
  @manage
  detail(@Param('eventId') eventId: string, @Req() request: AuthedRequest) {
    return this.events.detail(request.user, eventId);
  }

  @Patch(':eventId')
  @manage
  update(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    if (isProbe(body)) return { ok: true };
    return this.events.update(eventId, body, request.user);
  }

  @Post(':eventId/duplicate')
  @HttpCode(201)
  @manage
  duplicate(@Param('eventId') eventId: string, @Req() request: AuthedRequest) {
    return this.events.duplicate(request.user, eventId);
  }

  @Post(':eventId/publish')
  @HttpCode(200)
  @manage
  publish(@Param('eventId') eventId: string, @Req() request: AuthedRequest) {
    return this.events.publish(request.user, eventId);
  }

  @Post(':eventId/close')
  @HttpCode(200)
  @manage
  close(@Param('eventId') eventId: string, @Req() request: AuthedRequest) {
    return this.events.close(request.user, eventId);
  }

  @Post(':eventId/banner')
  @HttpCode(200)
  @manage
  @UseFilters(BannerExceptionFilter)
  @UseInterceptors(
    FileInterceptor('banner', { limits: { fileSize: BANNER_MAX_BYTES } }),
  )
  banner(
    @Param('eventId') eventId: string,
    @UploadedFile() file: Upload | undefined,
    @Req() request: AuthedRequest,
  ) {
    return this.events.saveBanner(request.user, eventId, file);
  }

  @Post(':eventId/locations')
  @HttpCode(201)
  @manage
  createLocation(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.createLocation(eventId, body, request.user);
  }

  @Delete(':eventId/locations/:locationId')
  @manage
  deleteLocation(
    @Param('eventId') eventId: string,
    @Param('locationId') locationId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.events.deleteLocation(eventId, locationId, request.user);
  }

  @Post(':eventId/members')
  @HttpCode(201)
  @manage
  invite(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.invite(eventId, body, request.user);
  }

  @Patch(':eventId/members/:memberId')
  @manage
  changeRole(
    @Param('eventId') eventId: string,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.changeRole(eventId, memberId, body, request.user);
  }

  @Delete(':eventId/members/:memberId')
  @manage
  removeMember(
    @Param('eventId') eventId: string,
    @Param('memberId') memberId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.events.removeMember(eventId, memberId, request.user);
  }

  @Post(':eventId/activities')
  @HttpCode(201)
  @manage
  createActivity(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.createActivity(eventId, body, request.user);
  }

  @Post(':eventId/activities/steam')
  @HttpCode(201)
  @manage
  createSteamStands(@Param('eventId') eventId: string, @Req() request: AuthedRequest) {
    return this.events.createSteamStands(eventId, request.user);
  }

  @Post(':eventId/activities/reorder')
  @HttpCode(200)
  @manage
  reorderActivities(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.reorderActivities(eventId, body, request.user);
  }

  @Patch(':eventId/activities/:activityId')
  @manage
  updateActivity(
    @Param('eventId') eventId: string,
    @Param('activityId') activityId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.updateActivity(eventId, activityId, body, request.user);
  }

  @Post(':eventId/activities/:activityId/duplicate')
  @HttpCode(201)
  @manage
  duplicateActivity(
    @Param('eventId') eventId: string,
    @Param('activityId') activityId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.events.duplicateActivity(eventId, activityId, request.user);
  }

  @Post(':eventId/form-fields')
  @HttpCode(201)
  @manage
  createFormField(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.createFormField(eventId, body, request.user);
  }

  @Post(':eventId/form-fields/reorder')
  @HttpCode(200)
  @manage
  reorderFormFields(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.reorderFormFields(eventId, body, request.user);
  }

  @Post(':eventId/form-fields/competitor')
  @HttpCode(201)
  @manage
  createCompetitorFields(@Param('eventId') eventId: string, @Req() request: AuthedRequest) {
    return this.events.createCompetitorFields(eventId, request.user);
  }

  @Patch(':eventId/form-fields/:fieldId')
  @manage
  updateFormField(
    @Param('eventId') eventId: string,
    @Param('fieldId') fieldId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.updateFormField(eventId, fieldId, body, request.user);
  }

  @Delete(':eventId/form-fields/:fieldId')
  @manage
  deleteFormField(
    @Param('eventId') eventId: string,
    @Param('fieldId') fieldId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.events.deleteFormField(eventId, fieldId, request.user);
  }

  @Get(':eventId/robotics-teams')
  @manage
  roboticsTeams(@Param('eventId') eventId: string) {
    return this.robotics.list(eventId);
  }

  @Delete(':eventId/activities/:activityId')
  @manage
  deleteActivity(
    @Param('eventId') eventId: string,
    @Param('activityId') activityId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.events.deleteActivity(eventId, activityId, request.user);
  }
}

@Catch()
class DocumentExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<HttpReply>();
    if (isFileTooLarge(exception)) {
      response.status(400).json({
        statusCode: 400,
        message: 'Cada documento pode ter no máximo 5 MB.',
      });
      return;
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const status = exception.getStatus();
      response
        .status(status)
        .json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }
    response.status(500).json({
      statusCode: 500,
      message: 'Não foi possível enviar o documento.',
    });
  }
}

@Controller('events')
export class PublicEventsController {
  constructor(
    private readonly events: EventsService,
    private readonly robotics: RoboticsService,
  ) {}

  @Get(':slug/preview')
  @UseGuards(AuthGuard)
  preview(@Param('slug') slug: string, @Req() request: AuthedRequest) {
    return this.events.previewBySlug(slug, request.user);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.events.publicBySlug(slug);
  }

  @Post(':slug/registrations')
  @HttpCode(201)
  @UseGuards(AuthGuard)
  register(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.events.register(slug, body, request.user);
  }

  @Get(':slug/teams')
  @UseGuards(AuthGuard)
  myTeams(@Param('slug') slug: string, @Req() request: AuthedRequest) {
    return this.robotics.mine(slug, request.user);
  }

  @Post(':slug/teams')
  @HttpCode(201)
  @UseGuards(AuthGuard)
  @UseFilters(DocumentExceptionFilter)
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 5 * 1024 * 1024, files: 6 } }))
  createTeam(
    @Param('slug') slug: string,
    @Body() body: { payload?: unknown },
    @UploadedFiles() files: IncomingFile[] | undefined,
    @Req() request: AuthedRequest,
  ) {
    return this.robotics.createTeam(slug, body?.payload, files ?? [], request.user);
  }

  @Patch(':slug/teams/:teamId')
  @UseGuards(AuthGuard)
  updateTeam(
    @Param('slug') slug: string,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
    @Req() request: AuthedRequest,
  ) {
    return this.robotics.updateTeam(slug, teamId, body, request.user);
  }

  @Post(':slug/teams/:teamId/members/:memberId/release')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  releaseMember(
    @Param('slug') slug: string,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.robotics.releaseMember(slug, teamId, memberId, request.user);
  }

  @Post(':slug/teams/:teamId/withdraw')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  withdrawTeam(
    @Param('slug') slug: string,
    @Param('teamId') teamId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.robotics.withdraw(slug, teamId, request.user);
  }

  @Get(':slug/teams/:teamId/documents/:documentId')
  @UseGuards(AuthGuard)
  async document(
    @Param('slug') slug: string,
    @Param('teamId') teamId: string,
    @Param('documentId') documentId: string,
    @Req() request: AuthedRequest,
  ): Promise<StreamableFile> {
    const file = await this.robotics.document(slug, teamId, documentId, request.user);
    return new StreamableFile(file.stream, {
      type: file.type,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Get(':name')
  async file(@Param('name') name: string): Promise<StreamableFile> {
    const key = uploadKey(name);
    if (!key) throw new NotFoundException('Arquivo não encontrado.');
    const type = name.endsWith('.png')
      ? 'image/png'
      : name.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    return new StreamableFile(await this.storage.get(key), {
      type,
      disposition: 'inline',
    });
  }
}

function isProbe(body: unknown): boolean {
  return (
    body == null ||
    (typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0)
  );
}

function isFileTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'LIMIT_FILE_SIZE'
  );
}
