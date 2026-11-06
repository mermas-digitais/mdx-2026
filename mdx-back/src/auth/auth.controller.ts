import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import type { AuthUser } from '../server/permissions.js';

export class LoginDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'A senha precisa ter pelo menos 8 caracteres.' })
  @MaxLength(72)
  password!: string;
}

export class RequestOtpDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @IsString()
  @Length(6, 6, { message: 'O código tem 6 dígitos.' })
  code!: string;
}

export class ProofRegisterDto {
  @IsString()
  @MinLength(20)
  proof!: string;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  @MinLength(2, { message: 'Informe seu nome.' })
  @MaxLength(80)
  name!: string;

  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @IsString()
  @MinLength(11, { message: 'Informe um CPF válido.' })
  @MaxLength(11, { message: 'Informe um CPF válido.' })
  cpf!: string;
}

export class CpfStatusDto {
  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @IsString()
  @Length(11, 11, { message: 'Informe um CPF válido.' })
  cpf!: string;

  @Transform(({ value }) => {
    const email = String(value ?? '').trim().toLowerCase();
    return email.length > 0 ? email : undefined;
  })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string;
}

export class PanelLoginDto {
  @IsString()
  @MinLength(1, { message: 'Informe a senha.' })
  @MaxLength(72)
  password!: string;
}

export class AdoptSessionDto {
  @IsString()
  @MinLength(20)
  token!: string;
}

export class RegisterDto extends LoginDto {
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @MinLength(2, { message: 'Informe seu nome.' })
  @MaxLength(80)
  name!: string;

  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @IsString()
  @MinLength(11, { message: 'Informe um CPF válido.' })
  @MaxLength(11, { message: 'Informe um CPF válido.' })
  cpf!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Post('panel-login')
  @HttpCode(200)
  panelLogin(@Body() body: PanelLoginDto) {
    return this.auth.panelLogin(body.password);
  }

  @Post('otp/request')
  @HttpCode(200)
  requestOtp(@Body() body: RequestOtpDto) {
    return this.auth.requestOtp(body.email);
  }

  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.auth.verifyOtp(body.email, body.code);
  }

  @Post('otp/start')
  @HttpCode(200)
  startOtp(@Body() body: RequestOtpDto) {
    return this.auth.startOtp(body.email);
  }

  @Post('otp/confirm')
  @HttpCode(200)
  confirmOtp(@Body() body: VerifyOtpDto) {
    return this.auth.confirmOtp(body.email, body.code);
  }

  @Post('cpf')
  @HttpCode(200)
  cpfStatus(@Body() body: CpfStatusDto) {
    return this.auth.cpfStatus(body.cpf, body.email);
  }

  @Post('register-proof')
  registerFromProof(@Body() body: ProofRegisterDto) {
    return this.auth.registerFromProof(body);
  }

  @Post('session')
  @HttpCode(200)
  adoptSession(@Body() body: AdoptSessionDto) {
    return this.auth.adoptSession(body.token);
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: { user: AuthUser }) {
    return this.auth.profile(request.user.id);
  }
}
