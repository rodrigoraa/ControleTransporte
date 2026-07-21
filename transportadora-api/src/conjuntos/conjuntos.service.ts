import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TipoCavaloMecanico, TipoConjuntoOperacional, TipoImplemento } from '@prisma/client';
import { AuditActor } from '../common/audit/audit-context';
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

  async create(dto: CreateConjuntoDto, actor?: AuditActor) {
    const cavalo = await this.getCavalo(dto.cavaloMecanicoId);
    await this.validateComposition(dto, cavalo);
    const implementos = await this.getImplementosInOrder(dto.implementoIds);
    const totals = this.calculateTotals(cavalo.tipoCavalo, implementos);
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
        observacoes: 'Conjunto operacional engatado ao cavalo mecânico',
      },
    });
    await this.audit('CRIACAO', created.id, null, created, actor);
    return created;
  }

  async update(id: string, dto: UpdateConjuntoDto, actor?: AuditActor) {
    const before = await this.findOne(id);
    const cavaloMecanicoId = dto.cavaloMecanicoId ?? before.cavaloMecanicoId;
    const implementoIds: string[] = dto.implementoIds ?? before.implementos.map((item: any) => item.implementoId);
    const cavalo = await this.getCavalo(cavaloMecanicoId);
    await this.validateComposition({ ...before, ...dto, cavaloMecanicoId, implementoIds } as CreateConjuntoDto, cavalo);
    const implementos = await this.getImplementosInOrder(implementoIds);
    const totals = this.calculateTotals(cavalo.tipoCavalo, implementos);
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
        observacoes: 'Alteração de composição registrada automaticamente',
      },
    });
    if ((before as any).cavaloMecanicoId !== updated.cavaloMecanicoId) {
      await this.registrarHistoricoCavalo((before as any).cavaloMecanicoId, 'DESENGATE_CONJUNTO', before, updated);
      await this.registrarHistoricoCavalo(updated.cavaloMecanicoId, 'ENGATE_CONJUNTO', before, updated);
    } else {
      await this.registrarHistoricoCavalo(updated.cavaloMecanicoId, 'ATUALIZACAO_ENGATE', before, updated);
    }
    await this.audit('ATUALIZACAO', id, before, updated, actor);
    return updated;
  }

  async historico(id: string) {
    await this.findOne(id);
    return this.prisma.historicoConjuntoOperacional.findMany({
      where: { conjuntoId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, actor?: AuditActor) {
    await this.assertNoRelatedRecords([
      {
        count: this.prisma.lancamentoFinanceiro.count({ where: { conjuntoId: id } }),
        message: 'Não foi possível excluir: conjunto possui lançamentos financeiros vinculados ao histórico.',
      },
      {
        count: this.prisma.historicoConjuntoOperacional.count({ where: { conjuntoId: id } }),
        message: 'Não foi possível excluir: conjunto possui histórico registrado. Inative o cadastro para preservar os dados.',
      },
    ]);
    return super.remove(id, actor);
  }

  private async validateComposition(dto: CreateConjuntoDto, cavalo?: { tipoCavalo?: TipoCavaloMecanico | null }) {
    if (!dto.cavaloMecanicoId) throw new BadRequestException('Conjunto operacional deve ter um cavalo mecânico.');
    if ((!dto.implementoIds || dto.implementoIds.length === 0) && !dto.justificativaSemImplemento) {
      throw new BadRequestException('Informe pelo menos um implemento ou uma justificativa para conjunto sem implemento.');
    }
    if (!dto.implementoIds?.length) return;

    const implementos = await this.getImplementosInOrder(dto.implementoIds);
    const hasDolly = implementos.some((item) => item.tipo === TipoImplemento.DOLLY);
    const carretas = implementos.filter((item) => item.tipo !== TipoImplemento.DOLLY);
    const dollys = implementos.filter((item) => item.tipo === TipoImplemento.DOLLY);

    if (hasDolly && implementos.every((item) => item.tipo === TipoImplemento.DOLLY)) {
      throw new BadRequestException('Dolly deve estar acompanhado de pelo menos uma carreta, semirreboque ou reboque.');
    }

    if (carretas.length > 2) {
      throw new BadRequestException('A composição deve ter no máximo duas carretas/reboques.');
    }

    if (dollys.length > 1) {
      throw new BadRequestException('A composição deve ter no máximo um dolly.');
    }

    if (carretas.length === 1 && hasDolly) {
      throw new BadRequestException('Se houver apenas uma carreta, não informe dolly.');
    }

    if (hasDolly && (implementos.length !== 3 || implementos[1]?.tipo !== TipoImplemento.DOLLY)) {
      throw new BadRequestException('No rodotrem, informe os implementos na ordem: 1ª carreta, dolly e 2ª carreta.');
    }

    if (hasDolly && !this.isThreeAxleCavalo(cavalo?.tipoCavalo)) {
      throw new BadRequestException('Rodotrem deve usar cavalo trucado ou traçado.');
    }

    if (carretas.some((item) => ![2, 3].includes(Number(item.quantidadeEixos)))) {
      throw new BadRequestException('Carretas devem ter 2 ou 3 eixos.');
    }
  }

  private calculateTotals(tipoCavalo: TipoCavaloMecanico | null | undefined, implementos: Array<{ tipo: TipoImplemento; quantidadeEixos: number; capacidadeCarga: Prisma.Decimal }>) {
    if (!implementos.length) return { eixos: 0, capacidade: new Prisma.Decimal(0) };
    return {
      eixos: this.cavaloEixos(tipoCavalo) + implementos.reduce((total, item) => total + (item.tipo === TipoImplemento.DOLLY ? 2 : item.quantidadeEixos), 0),
      capacidade: implementos.reduce((total, item) => total.add(item.capacidadeCarga), new Prisma.Decimal(0)),
    };
  }

  private async getImplementosInOrder(implementoIds: string[]) {
    const implementos = await this.prisma.implemento.findMany({ where: { id: { in: implementoIds } } });
    if (implementos.length !== new Set(implementoIds).size) throw new BadRequestException('Um ou mais implementos não foram encontrados.');
    const byId = new Map(implementos.map((item) => [item.id, item]));
    return implementoIds.map((id) => byId.get(id)!);
  }

  private async getCavalo(cavaloMecanicoId: string) {
    const cavalo = await this.prisma.cavaloMecanico.findUnique({ where: { id: cavaloMecanicoId } });
    if (!cavalo) throw new BadRequestException('Cavalo mecânico não encontrado.');
    return cavalo;
  }

  private buildNome(cavalo: { placa: string; marca: string | null }) {
    return [cavalo.placa, cavalo.marca].filter(Boolean).join(' - ');
  }

  private inferComposition(eixos: number, implementos: Array<{ tipo: TipoImplemento }>) {
    if (implementos.some((item) => item.tipo === TipoImplemento.DOLLY)) return { tipo: TipoConjuntoOperacional.RODOTREM, eixos };
    if (implementos.filter((item) => item.tipo !== TipoImplemento.DOLLY).length === 2) return { tipo: TipoConjuntoOperacional.BITREM, eixos };
    return { tipo: TipoConjuntoOperacional.SIMPLES, eixos };
  }

  private cavaloEixos(tipoCavalo: TipoCavaloMecanico | null | undefined) {
    if (tipoCavalo === TipoCavaloMecanico.SIMPLES_TOCO_4X2) return 2;
    if (tipoCavalo === TipoCavaloMecanico.TRUCADO_6X2 || tipoCavalo === TipoCavaloMecanico.TRACADO_6X4) return 3;
    return 0;
  }

  private isThreeAxleCavalo(tipoCavalo: TipoCavaloMecanico | null | undefined) {
    return tipoCavalo === TipoCavaloMecanico.TRUCADO_6X2 || tipoCavalo === TipoCavaloMecanico.TRACADO_6X4;
  }

  private async registrarHistoricoCavalo(cavaloMecanicoId: string | null | undefined, acao: string, antes: unknown, depois: unknown) {
    if (!cavaloMecanicoId) return;
    await this.prisma.historicoCavaloMecanico.create({
      data: {
        cavaloMecanicoId,
        acao,
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Histórico de engate do conjunto operacional',
      },
    });
  }
}
