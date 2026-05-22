import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PerfilUsuario } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/crud/pagination.dto';
import { AuditoriasService } from './auditorias.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
@Controller('auditorias')
export class AuditoriasController {
  constructor(private readonly service: AuditoriasService) {}

  @Get()
  findAll(@Query() query: PaginationDto & Record<string, string>) {
    return this.service.findAll(query);
  }
}
