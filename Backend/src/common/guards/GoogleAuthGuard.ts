import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): any {
    const req = context.switchToHttp().getRequest();

    if (req.query.code) {
      return {};
    }

    const res = context.switchToHttp().getResponse();
    const nonce = crypto.randomBytes(24).toString('hex');

    res.cookie('oauthNonce', nonce, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
      path: '/',
    });

    const role =
      req.query.role === 'TEACHER' || req.query.role === 'STUDENT'
        ? req.query.role
        : null;

    const state = this.jwtService.sign(
      { nonce, role },
      {
        secret: this.configService.getOrThrow<string>('GOOGLE_OAUTH_STATE_SECRET'),
        expiresIn: '5m',
      },
    );

    return { state, scope: ['email', 'profile'] };
  }
}
