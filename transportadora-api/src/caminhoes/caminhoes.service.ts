import { Injectable } from '@nestjs/common';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCaminhaoDto } from './dto/create-caminhao.dto';
import { UpdateCaminhaoDto } from './dto/update-caminhao.dto';

@Injectable()
export class CaminhoesService extends CrudService<CreateCaminhaoDto, UpdateCaminhaoDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'caminhao', ['placa', 'marca', 'modelo', 'tipo']);
  }

  async update(id: string, dto: UpdateCaminhaoDto) {
    const antes = await this.findOne(id);
    const depois = await super.update(id, dto);
    await this.prisma.historicoCaminhao.create({
      data: {
        caminhaoId: id,
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
    return this.prisma.historicoCaminhao.findMany({
      where: { caminhaoId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
