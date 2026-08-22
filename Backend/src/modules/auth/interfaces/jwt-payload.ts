export interface JwtPayload {
  sub: string;
  email: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN' | string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN' | string;
  userId?: string;
  refreshToken?: string;
}
