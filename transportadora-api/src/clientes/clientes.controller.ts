import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Controller('clientes')
export class ClientesController extends CrudController<CreateClienteDto, UpdateClienteDto> {
  constructor(service: ClientesService) {
    super(service);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/historico')
  historico(@Param('id') id: string) {
    return this.service.historico(id);
  }
}




