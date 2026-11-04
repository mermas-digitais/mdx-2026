import { Module } from '@nestjs/common';
import { AdminController, ContaController } from './access.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard, PermissionGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { LoginCodesRepository } from './login-codes.repository.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { MailerService } from './mailer.service.js';
import { TokenService } from './token.service.js';
import { UsersRepository } from './users.repository.js';

@Module({
  controllers: [AuthController, AdminController, ContaController],
  providers: [
    AuthService,
    AuthGuard,
    PermissionGuard,
    TokenService,
    LoginRateLimiter,
    LoginCodesRepository,
    MailerService,
    UsersRepository,
  ],
  exports: [TokenService, AuthGuard, PermissionGuard],
})
export class AuthModule {}
