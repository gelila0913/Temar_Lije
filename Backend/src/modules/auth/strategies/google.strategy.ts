import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'placeholder-google-client-id',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'placeholder-google-client-secret',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const email = profile.emails?.[0]?.value;
    const emailVerified = profile.emails?.[0]?.verified === true;

    if (!email) {
      return done(
        new Error('Google account has no accessible email address'),
        undefined,
      );
    }

    const normalizedProfile = {
      googleId: profile.id,
      email: email.trim().toLowerCase(),
      fullName: profile.displayName || email,
      emailVerified,
    };

    done(null, normalizedProfile);
  }
}
