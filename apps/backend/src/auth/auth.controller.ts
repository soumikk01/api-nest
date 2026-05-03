import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /auth/register
   * 3 requests per 5 minutes per IP — prevents account spam
   */
  @Throttle({
    short: { ttl: 300_000, limit: 3 },
    medium: { ttl: 300_000, limit: 3 },
  })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * 5 requests per 60 seconds per IP — brute-force protection
   */
  @Throttle({
    short: { ttl: 60_000, limit: 5 },
    medium: { ttl: 60_000, limit: 5 },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/admin/login
   * Issues a separate admin JWT (ADMIN_JWT_SECRET, 7d expiry).
   * Used exclusively by the Admin Panel — tokens cannot access user-only routes.
   */
  @Throttle({
    short: { ttl: 60_000, limit: 5 },
    medium: { ttl: 60_000, limit: 5 },
  })
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  adminLogin(@Body() dto: LoginDto) {
    return this.authService.adminLogin(dto);
  }


  /**
   * POST /auth/refresh
   * 30 requests per 60 seconds — generous for silent token renewal across tabs
   */
  @Throttle({
    short: { ttl: 60_000, limit: 30 },
    medium: { ttl: 60_000, limit: 30 },
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }
}
