import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ConjuntosService } from './conjuntos.service';
import { CreateConjuntoDto } from './dto/create-conjunto.dto';
import { UpdateConjuntoDto } from './dto/update-conjunto.dto';

@Controller('conjuntos')
export class ConjuntosController extends CrudController<CreateConjuntoDto, UpdateConjuntoDto> {
  constructor(service: ConjuntosService) {
    super(service);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/historico')
  historico(@Param('id') id: string) {
    return this.service.historico(id);
  }
}




