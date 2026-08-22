import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_SALT_ROUNDS = 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly _dummyHashPromise: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this._dummyHashPromise = this._hashPassword(
      'a-constant-placeholder-value-never-used-as-a-real-password',
    );
  }

  private _hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
  }

  private _generateSecureToken(ttlMs: number) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + ttlMs);
    return { rawToken, tokenHash, expiresAt };
  }

  private _deriveInitials(fullName?: string | null): string {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
  }

  private _toUserProfile(user: any) {
    return {
      id: user.id,
      fullName: user.fullName || user.name,
      email: user.email,
      role: user.role,
      initials: user.fullName
        ? this._deriveInitials(user.fullName)
        : user.initials || 'U',
      avatarBg: user.avatarBg || '#3b82f6',
    };
  }

  private async _registerFailedLoginAttempt(user: any) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const data: any = { failedLoginAttempts: attempts };

    if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      data.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      data.failedLoginAttempts = 0;
    }

    await this.prisma.user.update({ where: { id: user.id }, data });
  }

  private async _issueTokenPair(payload: { sub: string; email: string; role: string }) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this._hashPassword(dto.password);
    const { rawToken, tokenHash, expiresAt } = this._generateSecureToken(
      EMAIL_VERIFICATION_TOKEN_TTL_MS,
    );

    const isVerifiedImmediately = !this.emailService.isSmtpConfigured();

    let user: any;
    try {
      user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          name: dto.fullName,
          initials: this._deriveInitials(dto.fullName),
          email: dto.email,
          passwordHash,
          role: dto.role as any,
          isEmailVerified: isVerifiedImmediately,
          emailVerificationTokenHash: isVerifiedImmediately ? null : tokenHash,
          emailVerificationExpiresAt: isVerifiedImmediately ? null : expiresAt,
        },
      });
    } catch {
      throw new ConflictException('An account with this email already exists');
    }

    if (!isVerifiedImmediately) {
      await this.emailService.sendVerificationEmail(user, rawToken);
    } else {
      this.logger.log(`Account auto-verified for ${user.email} since SMTP is not configured.`);
    }

    // Auto-enroll student into classroom if code was provided during signup
    if (dto.classroomCode && (dto.role as any) === 'STUDENT') {
      try {
        const cleanCode = dto.classroomCode.trim().toUpperCase();
        const classroom = await this.prisma.classroom.findUnique({
          where: { inviteCode: cleanCode },
        });
        if (classroom && !classroom.deletedAt) {
          await this.prisma.classroomMember.create({
            data: {
              classroomId: classroom.id,
              userId: user.id,
            },
          });
          this.logger.log(`Student ${user.email} auto-enrolled in classroom ${classroom.title} (${cleanCode}).`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed auto-enrollment for ${user.email}: ${err?.message}`);
      }
    }

    return {
      message: isVerifiedImmediately
        ? 'Registration successful! You can now sign in.'
        : 'Registration successful. Please check your email to verify your account before signing in.',
    };
  }

  async verifyEmail(rawToken: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: { emailVerificationTokenHash: tokenHash },
    });

    if (
      !user ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired verification link');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });

    return { message: 'Email verified successfully. You can now sign in.' };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const generic = {
      message:
        'If an account with that email exists and is unverified, a new link has been sent.',
    };

    if (!user || user.isEmailVerified) {
      return generic;
    }

    const { rawToken, tokenHash, expiresAt } = this._generateSecureToken(
      EMAIL_VERIFICATION_TOKEN_TTL_MS,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    await this.emailService.sendVerificationEmail(user, rawToken);
    return generic;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const generic = {
      message:
        'If an account with that email exists, password reset instructions have been sent.',
    };

    if (!user) {
      return generic;
    }

    if (!user.passwordHash) {
      await this.emailService.sendOAuthAccountNotice(user);
      return generic;
    }

    const { rawToken, tokenHash, expiresAt } = this._generateSecureToken(
      PASSWORD_RESET_TOKEN_TTL_MS,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    await this.emailService.sendPasswordResetEmail(user, rawToken);
    return generic;
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash },
    });

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account does not use a password. Sign in with Google instead.',
      );
    }

    const passwordHash = await this._hashPassword(newPassword);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const payload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    };
    const { accessToken, refreshToken } = await this._issueTokenPair(payload);

    return {
      accessToken,
      refreshToken,
      user: this._toUserProfile(updatedUser),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account temporarily locked due to repeated failed attempts. Try again in ${minutesRemaining} minute(s).`,
      );
    }

    const realHash = user?.passwordHash;
    const hashToCheck = realHash ?? (await this._dummyHashPromise);
    const passwordMatches = realHash
      ? await bcrypt.compare(dto.password, hashToCheck)
      : false;

    if (!user || !realHash || !passwordMatches) {
      if (user && realHash) {
        await this._registerFailedLoginAttempt(user);
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before signing in. Check your inbox or request a new link.',
      );
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken } = await this._issueTokenPair(payload);

    return {
      accessToken,
      refreshToken,
      user: this._toUserProfile(user),
    };
  }

  async loginWithGoogle(
    googleProfile: { googleId: string; email: string; fullName: string; emailVerified: boolean },
    requestedRole?: string,
  ) {
    const { googleId, email, fullName, emailVerified } = googleProfile;

    let user = await this.prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        if (!emailVerified) {
          throw new UnauthorizedException(
            "This Google account's email is unverified and cannot be linked to an existing account",
          );
        }
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId, isEmailVerified: true },
        });
      } else {
        const roleToAssign =
          requestedRole === 'TEACHER' || requestedRole === 'STUDENT'
            ? requestedRole
            : 'STUDENT';

        user = await this.prisma.user.create({
          data: {
            fullName,
            name: fullName,
            initials: this._deriveInitials(fullName),
            email,
            googleId,
            role: roleToAssign as any,
            isEmailVerified: emailVerified === true,
            passwordHash: null,
          },
        });
      }
    }

    if (!user) {
      throw new UnauthorizedException('Unable to authenticate with Google');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken } = await this._issueTokenPair(payload);

    return {
      accessToken,
      refreshToken,
      user: this._toUserProfile(user),
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session expired, please log in again');
    }

    const incomingHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const storedHashBuffer = Buffer.from(user.refreshTokenHash, 'hex');
    const incomingHashBuffer = Buffer.from(incomingHash, 'hex');

    const hashesMatch =
      storedHashBuffer.length === incomingHashBuffer.length &&
      crypto.timingSafeEqual(storedHashBuffer, incomingHashBuffer);

    if (!hashesMatch) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('Session expired, please log in again');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken: newRefreshToken } =
      await this._issueTokenPair(payload);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: this._toUserProfile(user),
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }
}
