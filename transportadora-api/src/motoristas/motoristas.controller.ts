import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateMotoristaDto } from './dto/create-motorista.dto';
import { UpdateMotoristaDto } from './dto/update-motorista.dto';
import { MotoristasService } from './motoristas.service';

@Controller('motoristas')
export class MotoristasController extends CrudController<CreateMotoristaDto, UpdateMotoristaDto> {
  constructor(service: MotoristasService) {
    super(service);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/historico')
  historico(@Param('id') id: string) {
    return this.service.historico(id);
  }
}




