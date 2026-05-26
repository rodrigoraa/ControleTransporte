import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PerfilUsuario } from '@prisma/client';
import { CrudController } from '../common/crud/crud.controller';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CaminhoesService } from './caminhoes.service';
import { CreateCaminhaoDto } from './dto/create-caminhao.dto';
import { UpdateCaminhaoDto } from './dto/update-caminhao.dto';

@Controller('caminhoes')
export class CaminhoesController extends CrudController<CreateCaminhaoDto, UpdateCaminhaoDto> {
  constructor(service: CaminhoesService) {
    super(service);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/historico')
  historico(@Param('id') id: string) {
    return this.service.historico(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/composicao')
  composicao(@Param('id') id: string) {
    return this.service.composicaoAtual(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/composicao')
  @Roles(PerfilUsuario.ADMIN)
  atualizarComposicao(@Param('id') id: string, @Body() dto: UpdateCaminhaoDto) {
    return this.service.atualizarComposicao(id, dto);
  }
}
