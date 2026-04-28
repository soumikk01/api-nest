import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateAvatarDto } from './dto/update-avatar.dto';

interface AuthRequest extends Request {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  /** GET /users/me — current user profile */
  @Get('me')
  getMe(@Request() req: AuthRequest) {
    return this.usersService.findById(req.user.userId);
  }

  /** PATCH /users/me/avatar — update user avatar (validated 0–29) */
  @Patch('me/avatar')
  updateAvatar(@Request() req: AuthRequest, @Body() dto: UpdateAvatarDto) {
    return this.usersService.updateAvatar(req.user.userId, dto.avatar);
  }
}
