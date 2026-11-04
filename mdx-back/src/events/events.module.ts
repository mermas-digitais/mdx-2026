import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  AdminEventsController,
  PublicEventsController,
  UploadsController,
} from './events.controller.js';
import { EventsRepository } from './events.repository.js';
import { EventsService } from './events.service.js';
import { RoboticsRepository } from './robotics.repository.js';
import { RoboticsService } from './robotics.service.js';
import { StorageService } from '../storage/storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminEventsController, PublicEventsController, UploadsController],
  providers: [EventsService, EventsRepository, RoboticsService, RoboticsRepository, StorageService],
})
export class EventsModule {}
