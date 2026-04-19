import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  /** List all projects for a user, including API call count */
  async list(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { apiCalls: true } },
      },
    });
  }

  /** Create a new project */
  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { ...dto, userId },
    });
  }

  /** Get a single project (ownership verified) */
  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();
    return project;
  }

  /** Update project name / description */
  async update(projectId: string, userId: string, dto: UpdateProjectDto) {
    await this.findOne(projectId, userId); // verifies ownership
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  /** Delete a project + all its ApiCall records (Prisma cascade) */
  async remove(projectId: string, userId: string) {
    const project = await this.findOne(projectId, userId);
    await this.prisma.project.delete({ where: { id: project.id } });
    return { message: 'Project deleted' };
  }

  /**
   * Aggregate DB stats for the Overview dashboard.
   * Returns total calls, error count, error rate %, and avg latency.
   */
  async getStats(projectId: string, userId: string) {
    await this.findOne(projectId, userId); // guard

    const calls = await this.prisma.apiCall.findMany({
      where: { projectId },
      select: { status: true, latency: true, createdAt: true },
    });

    const total = calls.length;
    if (total === 0) {
      return {
        total: 0,
        errors: 0,
        errorRate: 0,
        avgLatency: 0,
        successRate: 100,
        activeInstances: 1,
      };
    }

    const errors = calls.filter(
      (c) => c.status === 'CLIENT_ERROR' || c.status === 'SERVER_ERROR',
    ).length;
    const avgLatency = Math.round(
      calls.reduce((sum, c) => sum + c.latency, 0) / total,
    );

    // Calls in the last 60 seconds count as "live"
    const now = Date.now();
    const recentCalls = calls.filter(
      (c) => now - new Date(c.createdAt).getTime() < 60_000,
    ).length;

    return {
      total,
      errors,
      errorRate: parseFloat(((errors / total) * 100).toFixed(1)),
      avgLatency,
      successRate: parseFloat((((total - errors) / total) * 100).toFixed(1)),
      activeInstances: recentCalls > 0 ? 1 : 0,
    };
  }

  /**
   * Return the most recent API calls persisted in the DB for a project.
   * Used to seed the Overview feed on page load before live socket events arrive.
   */
  async getRecentCalls(projectId: string, userId: string, limit = 50) {
    await this.findOne(projectId, userId); // guard

    return this.prisma.apiCall.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        method: true,
        url: true,
        path: true,
        host: true,
        statusCode: true,
        statusText: true,
        latency: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
