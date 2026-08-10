import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PerfilUsuario } from '@prisma/client';
import { AuditActor } from '../common/audit/audit-context';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/crud/pagination.dto';
import { AbastecimentosService } from './abastecimentos.service';
import { CreateAbastecimentoDto } from './dto/create-abastecimento.dto';
import { UpdateAbastecimentoDto } from './dto/update-abastecimento.dto';

@Controller('abastecimentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbastecimentosController {
  constructor(private readonly service: AbastecimentosService) {}

  @Get()
  findAll(@Query() query: PaginationDto, @Query('cavaloMecanicoId') cavaloMecanicoId?: string) {
    return cavaloMecanicoId ? this.service.findByCavalo(cavaloMecanicoId) : this.service.findAll(query);
  }

  @Post()
  @Roles(PerfilUsuario.ADMIN)
  create(@Body() dto: CreateAbastecimentoDto, @CurrentUser() actor: AuditActor) {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateAbastecimentoDto, @CurrentUser() actor: AuditActor) {
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() actor: AuditActor) {
    return this.service.remove(id, actor);
  }
}
