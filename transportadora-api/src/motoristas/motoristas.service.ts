import { Injectable } from '@nestjs/common';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMotoristaDto } from './dto/create-motorista.dto';
import { UpdateMotoristaDto } from './dto/update-motorista.dto';

@Injectable()
export class MotoristasService extends CrudService<CreateMotoristaDto, UpdateMotoristaDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'motorista', ['nome', 'cpf', 'cnh', 'telefone']);
  }

  async update(id: string, dto: UpdateMotoristaDto) {
    const antes = await this.findOne(id);
    const depois = await super.update(id, dto);
    await this.prisma.historicoMotorista.create({
      data: {
        motoristaId: id,
        acao: 'ATUALIZACAO',
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Alteracao registrada automaticamente',
      },
    });
    return depois;
  }

  async historico(id: string) {
    await this.findOne(id);
    return this.prisma.historicoMotorista.findMany({
      where: { motoristaId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
