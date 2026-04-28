import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    // Never return the hashed password
    const { password: _pw, ...safe } = user;
    return safe;
  }

  /** Update user's avatar index */
  async updateAvatar(userId: string, avatar: number) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar },
    });
    const { password: _pw, ...safe } = user;
    return safe;
  }
}
