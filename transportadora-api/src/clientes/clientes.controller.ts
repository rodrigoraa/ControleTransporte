import { Controller } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Controller('clientes')
export class ClientesController extends CrudController<CreateClienteDto, UpdateClienteDto> {
  constructor(service: ClientesService) {
    super(service);
  }
}
