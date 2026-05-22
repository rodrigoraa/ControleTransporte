import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TipoConjuntoOperacional, TipoImplemento } from '@prisma/client';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateConjuntoDto } from './dto/create-conjunto.dto';
import { UpdateConjuntoDto } from './dto/update-conjunto.dto';

@Injectable()
export class ConjuntosService extends CrudService<CreateConjuntoDto, UpdateConjuntoDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'conjunto', ['nome'], {
      cavaloMecanico: true,
      implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' } },
    });
  }

  async create(dto: CreateConjuntoDto) {
    await this.validateComposition(dto);
    const cavalo = await this.getCavalo(dto.cavaloMecanicoId);
    const implementos = await this.getImplementosInOrder(dto.implementoIds);
    const totals = this.calculateTotals(implementos);
    const composition = this.inferComposition(totals.eixos, implementos);
    const created = await this.prisma.conjunto.create({
      data: {
        nome: this.buildNome(cavalo),
        tipo: composition.tipo,
        cavaloMecanicoId: dto.cavaloMecanicoId,
        quantidadeTotalEixos: composition.eixos,
        capacidadeTotal: totals.capacidade,
        status: dto.status || 'ATIVO',
        justificativaSemImplemento: dto.justificativaSemImplemento || null,
        observacoes: dto.observacoes || null,
        implementos: {
          create: dto.implementoIds.map((implementoId, index) => ({ implementoId, ordem: index + 1 })),
        },
      },
      include: this.include as any,
    });
    await this.prisma.historicoCavaloMecanico.create({
      data: {
        cavaloMecanicoId: created.cavaloMecanicoId,
        acao: 'ENGATE_CONJUNTO',
        dadosAntes: undefined,
        dadosDepois: JSON.parse(JSON.stringify(created)),
        observacoes: 'Conjunto operacional engatado ao cavalo mecanico',
      },
    });
    await this.audit('CRIACAO', created.id, null, created);
    return created;
  }

  async update(id: string, dto: UpdateConjuntoDto) {
    const before = await this.findOne(id);
    const cavaloMecanicoId = dto.cavaloMecanicoId ?? before.cavaloMecanicoId;
    const implementoIds: string[] = dto.implementoIds ?? before.implementos.map((item: any) => item.implementoId);
    await this.validateComposition({ ...before, ...dto, cavaloMecanicoId, implementoIds } as CreateConjuntoDto);
    const cavalo = await this.getCavalo(cavaloMecanicoId);
    const implementos = await this.getImplementosInOrder(implementoIds);
    const totals = this.calculateTotals(implementos);
    const composition = this.inferComposition(totals.eixos, implementos);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.implementoIds) {
        await tx.conjuntoImplemento.deleteMany({ where: { conjuntoId: id } });
      }
      return tx.conjunto.update({
        where: { id },
        data: {
          nome: this.buildNome(cavalo),
          tipo: composition.tipo,
          cavaloMecanicoId: dto.cavaloMecanicoId,
          quantidadeTotalEixos: composition.eixos,
          capacidadeTotal: totals.capacidade,
          status: dto.status || undefined,
          justificativaSemImplemento: dto.justificativaSemImplemento,
          observacoes: dto.observacoes,
          ...(dto.implementoIds
            ? { implementos: { create: implementoIds.map((implementoId: string, index: number) => ({ implementoId, ordem: index + 1 })) } }
            : {}),
        },
        include: this.include as any,
      });
    });
    await this.prisma.historicoConjuntoOperacional.create({
      data: {
        conjuntoId: id,
        acao: 'ATUALIZACAO_COMPOSICAO',
        dadosAntes: JSON.parse(JSON.stringify(before)),
        dadosDepois: JSON.parse(JSON.stringify(updated)),
        observacoes: 'Alteracao de composicao registrada automaticamente',
      },
    });
    if ((before as any).cavaloMecanicoId !== updated.cavaloMecanicoId) {
      await this.registrarHistoricoCavalo((before as any).cavaloMecanicoId, 'DESENGATE_CONJUNTO', before, updated);
      await this.registrarHistoricoCavalo(updated.cavaloMecanicoId, 'ENGATE_CONJUNTO', before, updated);
    } else {
      await this.registrarHistoricoCavalo(updated.cavaloMecanicoId, 'ATUALIZACAO_ENGATE', before, updated);
    }
    await this.audit('ATUALIZACAO', id, before, updated);
    return updated;
  }

  async historico(id: string) {
    await this.findOne(id);
    return this.prisma.historicoConjuntoOperacional.findMany({
      where: { conjuntoId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async validateComposition(dto: CreateConjuntoDto) {
    if (!dto.cavaloMecanicoId) throw new BadRequestException('Conjunto operacional deve ter um cavalo mecanico.');
    if ((!dto.implementoIds || dto.implementoIds.length === 0) && !dto.justificativaSemImplemento) {
      throw new BadRequestException('Informe pelo menos um implemento ou uma justificativa para conjunto sem implemento.');
    }
    if (!dto.implementoIds?.length) return;

    const implementos = await this.getImplementosInOrder(dto.implementoIds);
    const hasDolly = implementos.some((item) => item.tipo === TipoImplemento.DOLLY);
    const inferred = this.inferComposition(0, implementos);

    if (hasDolly && implementos.length < 3) {
      throw new BadRequestException('Composicao com dolly deve ter 1a carreta, dolly e 2a carreta.');
    }

    if (inferred.tipo === TipoConjuntoOperacional.BITREM) {
      if (implementos.length < 2) {
        throw new BadRequestException('Bitrem 7 eixos deve ter 1a carreta e 2a carreta.');
      }
      if (hasDolly) {
        throw new BadRequestException('Bitrem 7 eixos nao deve usar dolly. Para 1a carreta + dolly + 2a carreta, cadastre como Rodotrem.');
      }
    }

    if (inferred.tipo === TipoConjuntoOperacional.RODOTREM) {
      if (implementos.length < 3 || !hasDolly) {
        throw new BadRequestException('Rodotrem 9 eixos deve ter 1a carreta, dolly e 2a carreta.');
      }
    }
  }

  private calculateTotals(implementos: Array<{ quantidadeEixos: number; capacidadeCarga: Prisma.Decimal }>) {
    if (!implementos.length) return { eixos: 0, capacidade: new Prisma.Decimal(0) };
    return {
      eixos: implementos.reduce((total, item) => total + item.quantidadeEixos, 0),
      capacidade: implementos.reduce((total, item) => total.add(item.capacidadeCarga), new Prisma.Decimal(0)),
    };
  }

  private async getImplementosInOrder(implementoIds: string[]) {
    const implementos = await this.prisma.implemento.findMany({ where: { id: { in: implementoIds } } });
    if (implementos.length !== new Set(implementoIds).size) throw new BadRequestException('Um ou mais implementos nao foram encontrados.');
    const byId = new Map(implementos.map((item) => [item.id, item]));
    return implementoIds.map((id) => byId.get(id)!);
  }

  private async getCavalo(cavaloMecanicoId: string) {
    const cavalo = await this.prisma.cavaloMecanico.findUnique({ where: { id: cavaloMecanicoId } });
    if (!cavalo) throw new BadRequestException('Cavalo mecanico nao encontrado.');
    return cavalo;
  }

  private buildNome(cavalo: { placa: string; marca: string | null }) {
    return [cavalo.placa, cavalo.marca].filter(Boolean).join(' - ');
  }

  private inferComposition(eixos: number, implementos: Array<{ tipo: TipoImplemento }>) {
    const hasDolly = implementos.some((item) => item.tipo === TipoImplemento.DOLLY);
    if (hasDolly && implementos.length >= 3) return { tipo: TipoConjuntoOperacional.RODOTREM, eixos: 9 };
    if (!hasDolly && implementos.length >= 2) return { tipo: TipoConjuntoOperacional.BITREM, eixos: 7 };
    if (eixos >= 9) return { tipo: TipoConjuntoOperacional.RODOTREM, eixos };
    if (eixos >= 7) return { tipo: TipoConjuntoOperacional.BITREM, eixos };
    return { tipo: TipoConjuntoOperacional.SIMPLES, eixos };
  }

  private async registrarHistoricoCavalo(cavaloMecanicoId: string | null | undefined, acao: string, antes: unknown, depois: unknown) {
    if (!cavaloMecanicoId) return;
    await this.prisma.historicoCavaloMecanico.create({
      data: {
        cavaloMecanicoId,
        acao,
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Historico de engate do conjunto operacional',
      },
    });
  }
}
