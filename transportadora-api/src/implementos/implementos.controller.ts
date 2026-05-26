import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateImplementoDto } from './dto/create-implemento.dto';
import { UpdateImplementoDto } from './dto/update-implemento.dto';
import { ImplementosService } from './implementos.service';

@Controller('implementos')
export class ImplementosController extends CrudController<CreateImplementoDto, UpdateImplementoDto> {
  constructor(service: ImplementosService) {
    super(service);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/historico')
  historico(@Param('id') id: string) {
    return this.service.historico(id);
  }
}




