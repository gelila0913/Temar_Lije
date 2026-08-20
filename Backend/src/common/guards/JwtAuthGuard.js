import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * @param {unknown} err
   * @param {unknown} user
   * @returns {unknown}
   */
  handleRequest(err, user) {
    if (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new UnauthorizedException('Authentication failed');
    }
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    return user;
  }
}

@Injectable()
class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user) {
    if (err || !user) {
      return null;
    }
    return user;
  }
}

module.exports = { JwtAuthGuard, OptionalJwtAuthGuard };
