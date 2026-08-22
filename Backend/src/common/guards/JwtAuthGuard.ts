import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
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
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
