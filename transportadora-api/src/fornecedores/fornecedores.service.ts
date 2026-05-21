import { Injectable } from '@nestjs/common';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';

@Injectable()
export class FornecedoresService extends CrudService<CreateFornecedorDto, UpdateFornecedorDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'fornecedor', ['nome', 'documento', 'telefone', 'email']);
  }
}
