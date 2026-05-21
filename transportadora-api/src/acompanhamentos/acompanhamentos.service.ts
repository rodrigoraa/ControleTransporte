import { Injectable } from '@nestjs/common';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAcompanhamentoDto } from './dto/create-acompanhamento.dto';
import { UpdateAcompanhamentoDto } from './dto/update-acompanhamento.dto';

@Injectable()
export class AcompanhamentosService extends CrudService<CreateAcompanhamentoDto, UpdateAcompanhamentoDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'acompanhamento', ['tipoOperacao', 'tipoVeiculo'], {
      caminhao: true,
      motorista: true,
    });
  }
}
