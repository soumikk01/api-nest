import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { QueryHistoryDto } from './dto/query-history.dto';

const HISTORY_LIST_TTL = 15; // seconds — paginated list
const HISTORY_ITEM_TTL = 60; // seconds — single call detail
const ACCESS_TTL = 60; // seconds — project access check

@Injectable()
export class HistoryService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Paginated list of API calls, filtered by status/method.
   * Cache key encodes all filter params so each unique query has its own bucket.
   */
  async findAll(userId: string, query: QueryHistoryDto) {
    const { projectId, page = 1, limit = 50, status, method } = query;

    // Cache access check — avoids DB hit on every paginated request
    const accessKey = `access:${projectId}:${userId}`;
    const accessCached = await this.cache.get<boolean>(accessKey);
    if (!accessCached) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [{ userId }, { members: { some: { userId } } }],
        },
      });
      if (!project)
        throw new ForbiddenException('Project not found or access denied');
      await this.cache.set(accessKey, true, ACCESS_TTL);
    }

    // Build a deterministic cache key from all filter params
    const cacheKey = `history:${projectId}:p${page}:l${limit}:s${status ?? ''}:m${method ?? ''}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status.toUpperCase();
    if (method) where.method = method.toUpperCase();

    const [total, calls] = await Promise.all([
      this.prisma.apiCall.count({ where }),
      this.prisma.apiCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const result = {
      data: calls,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, result, HISTORY_LIST_TTL);
    return result;
  }

  /**
   * Single API call detail — cached for 60s (immutable once written).
   * Fix #9: ownership check now validates project access (owner OR member),
   * not apiCall.userId equality — which was the project owner's ID, not the
   * requesting user's ID, so project members always got 403.
   */
  async findOne(id: string, userId: string) {
    const cacheKey = `history:call:${id}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) {
      const call = cached as { projectId: string; userId: string };
      // Fast path: owner check without DB hit
      if (call.userId === userId) return cached;
      // Member check: still need a DB lookup (membership can't be cached safely here)
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: call.projectId, userId } },
      });
      if (!member) throw new ForbiddenException();
      return cached;
    }

    const call = await this.prisma.apiCall.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('API call not found');

    // Check ownership or project membership
    if (call.userId !== userId) {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: call.projectId, userId } },
      });
      if (!member) throw new ForbiddenException();
    }

    await this.cache.set(cacheKey, call, HISTORY_ITEM_TTL);
    return call;
  }
}
