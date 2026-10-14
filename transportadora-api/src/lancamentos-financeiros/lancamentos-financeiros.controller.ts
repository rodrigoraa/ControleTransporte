import { Controller } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { Body, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PerfilUsuario } from '@prisma/client';
import { AuditActor } from '../common/audit/audit-context';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateLancamentoFinanceiroDto } from './dto/create-lancamento-financeiro.dto';
import { UpdateLancamentoFinanceiroDto } from './dto/update-lancamento-financeiro.dto';
import { LancamentosFinanceirosService } from './lancamentos-financeiros.service';
import { UpdateCategoriaImportadoDto } from './dto/update-categoria-importado.dto';

@Controller('lancamentos-financeiros')
export class LancamentosFinanceirosController extends CrudController<CreateLancamentoFinanceiroDto, UpdateLancamentoFinanceiroDto> {
  constructor(service: LancamentosFinanceirosService) {
    super(service);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.ADMIN)
  create(@Body() dto: CreateLancamentoFinanceiroDto, @CurrentUser() user: AuditActor) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateLancamentoFinanceiroDto, @CurrentUser() user: AuditActor) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/categoria')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.ADMIN)
  atualizarCategoria(@Param('id') id: string, @Body() dto: UpdateCategoriaImportadoDto, @CurrentUser() user: AuditActor) {
    return this.service.atualizarCategoriaImportado(id, dto, user);
  }
}




