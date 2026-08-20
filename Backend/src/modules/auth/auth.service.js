const {
  ConflictException,
  Injectable,
  Dependencies,
  UnauthorizedException,
} = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { ConfigService } = require('@nestjs/config');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const { PrismaService } = require('../../database/prisma.service');
const { EmailService } = require('../email/email.service');

const BCRYPT_SALT_ROUNDS = 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
@Dependencies(PrismaService, JwtService, ConfigService, EmailService)
class AuthService {
  constructor(prisma, jwtService, configService, emailService) {
    this.prisma = prisma;
    this.jwtService = jwtService;
    this.configService = configService;
    this.emailService = emailService;

    this._dummyHashPromise = this._hashPassword(
      'a-constant-placeholder-value-never-used-as-a-real-password',
    );
  }

  _hashPassword(plain) {
    return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
  }

  _generateSecureToken(ttlMs) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + ttlMs);
    return { rawToken, tokenHash, expiresAt };
  }

  _deriveInitials(fullName) {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
  }

  _toUserProfile(user) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      initials: user.fullName
        ? this._deriveInitials(user.fullName)
        : user.initials || 'U',
      avatarBg: user.avatarBg || '#3b82f6',
    };
  }

  async _registerFailedLoginAttempt(user) {
    const attempts = user.failedLoginAttempts + 1;
    const data = { failedLoginAttempts: attempts };

    if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      data.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      data.failedLoginAttempts = 0;
    }

    await this.prisma.user.update({ where: { id: user.id }, data });
  }

  async _issueTokenPair(payload) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
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

  /**
   * Registers a new STUDENT or TEACHER account. As of email
   * verification being added: this NO LONGER logs the user in.
   * Returns a plain confirmation message instead of an AuthResult.
   */
  async register(dto) {
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

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          name: dto.fullName,
          initials: this._deriveInitials(dto.fullName),
          email: dto.email,
          passwordHash,
          role: dto.role,
          isEmailVerified: false,
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: expiresAt,
        },
      });
    } catch {
      throw new ConflictException('An account with this email already exists');
    }

    await this.emailService.sendVerificationEmail(user, rawToken);

    return {
      message:
        'Registration successful. Please check your email to verify your account before signing in.',
    };
  }

  /**
   * Confirms a user's email using the raw token from the link they clicked.
   */
  async verifyEmail(rawToken) {
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

  /**
   * Always returns the same generic message regardless of whether
   * the email exists, is already verified, or genuinely gets a new token.
   */
  async resendVerificationEmail(email) {
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

  /**
   * Always returns the same generic response regardless of what's
   * true about the account (non-existent, OAuth-only, or local password).
   * For OAuth accounts, sends an informational notice instead of a reset link.
   */
  async forgotPassword(email) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const generic = {
      message:
        'If an account with that email exists, password reset instructions have been sent.',
    };

    if (!user) {
      return generic;
    }

    if (!user.passwordHash) {
      // OAuth-only account (Google, or any future provider)
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

  /**
   * Consumes a reset token and sets a new password.
   * On success, invalidates existing refresh tokens and clears lockout.
   */
  async resetPassword(rawToken, newPassword) {
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
        refreshTokenHash: null, // force re-login everywhere else
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

  async login(dto) {
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
    const passwordMatches = await bcrypt.compare(dto.password, hashToCheck);

    if (!user || !realHash || !passwordMatches) {
      if (user && realHash) {
        await this._registerFailedLoginAttempt(user);
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    // Placed here deliberately — AFTER the password has already been
    // proven correct, to prevent enumeration.
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

  /**
   * Finds or creates a user from a verified Google profile, then
   * issues the same access+refresh pair as password login.
   */
  async loginWithGoogle(googleProfile, requestedRole) {
    const { googleId, email, fullName, emailVerified } = googleProfile;

    // Path 1: returning user who already linked Google previously.
    let user = await this.prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      // Path 2: no googleId match, but an email/password account
      // already owns this email — link rather than create a duplicate.
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
        // Path 3: genuinely new user.
        if (requestedRole !== 'STUDENT' && requestedRole !== 'TEACHER') {
          throw new UnauthorizedException(
            'No account found for this Google email. Please create an account first and select your role.',
          );
        }

        user = await this.prisma.user.create({
          data: {
            fullName,
            name: fullName,
            initials: this._deriveInitials(fullName),
            email,
            googleId,
            role: requestedRole,
            isEmailVerified: emailVerified,
            passwordHash: null,
          },
        });
      }
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

  async refreshTokens(userId, refreshToken) {
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

  async logout(userId) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }
}

module.exports = { AuthService };
