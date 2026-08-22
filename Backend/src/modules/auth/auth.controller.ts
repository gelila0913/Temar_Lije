import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/JwtAuthGuard';
import { JwtRefreshGuard } from '../../common/guards/JwtRefreshGuard';
import { GoogleAuthGuard } from '../../common/guards/GoogleAuthGuard';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private _refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    };
  }

  private _setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(
      REFRESH_COOKIE_NAME,
      refreshToken,
      this._refreshCookieOptions(),
    );
  }

  private _sendAuthResult(res: Response, result: any) {
    this._setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    return result;
  }

  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    return this._sendAuthResult(res, result);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 per 15 minutes
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 per 15 minutes
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.resetPassword(
      dto.token,
      dto.newPassword,
    );
    return this._sendAuthResult(res, result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const refreshToken =
      req.user?.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await this.authService.refreshTokens(userId, refreshToken);
    return this._sendAuthResult(res, result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    await this.authService.logout(userId);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return { message: 'Logged out successfully' };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const host =
      (req.headers['x-forwarded-host'] as string) ||
      req.headers.host ||
      'localhost:5173';
    const proto =
      (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const frontendBaseUrl = `${proto}://${host}`;
    const frontendErrorUrl = `${frontendBaseUrl}/signin?error=oauth_failed`;

    res.clearCookie('oauthNonce', { path: '/' });

    if (!req.user) {
      return res.redirect(frontendErrorUrl);
    }

    let requestedRole = 'STUDENT';
    if (req.query.state) {
      try {
        const statePayload: any = this.jwtService.verify(req.query.state as string, {
          secret: this.configService.getOrThrow('GOOGLE_OAUTH_STATE_SECRET'),
        });
        if (statePayload && statePayload.role) {
          requestedRole = statePayload.role;
        }
      } catch {
        // Continue with default role
      }
    }

    try {
      const result = await this.authService.loginWithGoogle(
        req.user,
        requestedRole,
      );
      this._setRefreshCookie(res, result.refreshToken);
      return res.redirect(`${frontendBaseUrl}/oauth/callback`);
    } catch (err: any) {
      const message = encodeURIComponent(
        err.message || 'Google sign-in failed',
      );
      return res.redirect(`${frontendErrorUrl}&message=${message}`);
    }
  }
}
