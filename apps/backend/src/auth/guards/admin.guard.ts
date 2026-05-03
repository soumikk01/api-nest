import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * AdminGuard — restricts an endpoint to tokens issued via the admin-jwt strategy.
 * The admin JWT payload contains `role: 'admin'` set by AdminJwtStrategy.validate().
 * Any regular user JWT will not have this field and will be rejected with 403.
 *
 * Usage:  @UseGuards(AdminGuard)
 */
@Injectable()
export class AdminGuard extends AuthGuard('jwt') implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First run the standard JWT guard to ensure the token is valid at all
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) return false;

    const request = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const user = request.user;

    // Only tokens that have been explicitly issued with role='admin' are allowed.
    // Regular user JWTs do not carry this field so they will be rejected here.
    if (user?.role !== 'admin') {
      throw new ForbiddenException(
        'This action is restricted to admin users only.',
      );
    }

    return true;
  }
}
