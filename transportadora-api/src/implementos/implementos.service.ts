import { Injectable } from '@nestjs/common';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateImplementoDto } from './dto/create-implemento.dto';
import { UpdateImplementoDto } from './dto/update-implemento.dto';

@Injectable()
export class ImplementosService extends CrudService<CreateImplementoDto, UpdateImplementoDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'implemento', ['placa', 'tipo', 'carroceria']);
  }

  async update(id: string, dto: UpdateImplementoDto) {
    const antes = await this.findOne(id);
    const depois = await super.update(id, dto);
    await this.prisma.historicoImplemento.create({
      data: {
        implementoId: id,
        acao: 'ATUALIZACAO',
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Alteracao de implemento registrada automaticamente',
      },
    });
    return depois;
  }

  async historico(id: string) {
    await this.findOne(id);
    return this.prisma.historicoImplemento.findMany({
      where: { implementoId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  protected normalizeCreate(dto: CreateImplementoDto) {
    return {
      ...dto,
      quantidadeEixos: dto.quantidadeEixos ?? 0,
      capacidadeCarga: dto.capacidadeCarga ?? 0,
    };
  }

  protected normalizeUpdate(dto: UpdateImplementoDto) {
    const data: any = { ...dto };
    if ('quantidadeEixos' in data && data.quantidadeEixos == null) data.quantidadeEixos = 0;
    if ('capacidadeCarga' in data && data.capacidadeCarga == null) data.capacidadeCarga = 0;
    return data;
  }
}
