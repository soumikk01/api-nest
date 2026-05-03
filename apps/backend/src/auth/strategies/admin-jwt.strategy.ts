import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: 'admin';
  iat?: number;
  exp?: number;
}

/**
 * Separate JWT strategy for the Admin Panel.
 * Uses ADMIN_JWT_SECRET — completely isolated from the user JWT.
 * Tokens issued via POST /auth/admin/login expire after ADMIN_JWT_EXPIRY (default 7d).
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('ADMIN_JWT_SECRET');
    if (!secret) throw new Error('ADMIN_JWT_SECRET env var is not set — refusing to start');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: AdminJwtPayload) {
    // Ensure only admin-role tokens pass this guard
    if (payload.role !== 'admin') return null;
    return { userId: payload.sub, email: payload.email, role: 'admin' as const };
  }
}
