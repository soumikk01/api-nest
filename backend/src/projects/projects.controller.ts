import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthRequest extends Request {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  /** GET /projects — list user's projects */
  @Get()
  list(@Request() req: AuthRequest) {
    return this.projectsService.list(req.user.userId);
  }

  /** POST /projects — create project */
  @Post()
  create(@Request() req: AuthRequest, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.userId, dto);
  }

  /** GET /projects/:id */
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.projectsService.findOne(id, req.user.userId);
  }

  /** DELETE /projects/:id */
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.projectsService.remove(id, req.user.userId);
  }
}
