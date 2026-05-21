import { Injectable } from '@nestjs/common';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService extends CrudService<CreateClienteDto, UpdateClienteDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'cliente', ['nome', 'documento', 'telefone', 'email']);
  }
}
