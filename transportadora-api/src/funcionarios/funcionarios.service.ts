import { Injectable } from '@nestjs/common';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';

@Injectable()
export class FuncionariosService extends CrudService<CreateFuncionarioDto, UpdateFuncionarioDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'funcionario', ['nome', 'cpf', 'cargo']);
  }
}
