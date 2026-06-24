import { Body, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PerfilUsuario } from '@prisma/client';
import { AuditActor } from '../audit/audit-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { PaginationDto } from './pagination.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
export abstract class CrudController<CreateDto extends object, UpdateDto extends object> {
  protected constructor(protected readonly service: any) {}

  @Post()
  @Roles(PerfilUsuario.ADMIN)
  create(@Body() dto: CreateDto, @CurrentUser() user: AuditActor) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDto, @CurrentUser() user: AuditActor) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuditActor) {
    return this.service.remove(id, user);
  }
}
