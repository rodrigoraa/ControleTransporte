import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ComposicoesCavaloService, TransferenciaImplemento } from '../caminhoes/composicoes-cavalo.service';
import { AuditActor } from '../common/audit/audit-context';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateConjuntoDto } from './dto/create-conjunto.dto';
import { UpdateConjuntoDto } from './dto/update-conjunto.dto';

const conjuntoInclude = {
  cavaloMecanico: true,
  implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' as const } },
} satisfies Prisma.ConjuntoInclude;

@Injectable()
export class ConjuntosService extends CrudService<CreateConjuntoDto, UpdateConjuntoDto> {
  constructor(
    prisma: PrismaService,
    private readonly composicoes: ComposicoesCavaloService,
  ) {
    super(prisma, 'conjunto', ['nome'], conjuntoInclude);
  }

  async create(dto: CreateConjuntoDto, actor?: AuditActor) {
    const created = await this.composicoes.runCompositionTransaction<any>(this.prisma, async (tx) => {
      const { cavalo, implementos } = await this.loadComposition(tx, dto);
      const timestamp = new Date();
      const status = dto.status || 'ATIVO';
      const transferencias = status === 'ATIVO'
        ? await this.prepareActiveComposition(tx, cavalo.id, dto.implementoIds, timestamp)
        : [];
      const conjunto = await this.composicoes.createConjunto(
        tx, cavalo, implementos, status, dto.observacoes || null, timestamp, dto.justificativaSemImplemento || null,
      );
      await this.composicoes.registrarTransferencias(tx, transferencias, conjunto, timestamp);
      await this.registrarHistoricoCavalo(tx, cavalo.id, status === 'ATIVO' ? 'ENGATE_CONJUNTO' : 'CADASTRO_CONJUNTO', null, conjunto, timestamp);
      return conjunto;
    });
    await this.audit('CRIACAO', created.id, null, created, actor);
    return created;
  }

  async update(id: string, dto: UpdateConjuntoDto, actor?: AuditActor) {
    const result = await this.composicoes.runCompositionTransaction<any>(this.prisma, async (tx) => {
      const before = await tx.conjunto.findUnique({ where: { id }, include: conjuntoInclude });
      if (!before) throw new NotFoundException('Registro não encontrado.');
      const implementoIds: string[] = dto.implementoIds ?? before.implementos.map((item: any) => item.implementoId);
      const cavaloMecanicoId = dto.cavaloMecanicoId ?? before.cavaloMecanicoId;
      const justificativaSemImplemento = dto.justificativaSemImplemento !== undefined
        ? dto.justificativaSemImplemento
        : before.justificativaSemImplemento;
      const status = dto.status || before.status;
      const observacoes = dto.observacoes !== undefined ? dto.observacoes : before.observacoes;
      const compositionChanged = cavaloMecanicoId !== before.cavaloMecanicoId
        || implementoIds.length !== before.implementos.length
        || implementoIds.some((implementoId, index) => implementoId !== before.implementos[index].implementoId);
      const reactivating = before.status !== 'ATIVO' && status === 'ATIVO';
      const timestamp = new Date();
      let updated: any;

      if (compositionChanged || reactivating) {
        const { cavalo, implementos } = await this.loadComposition(tx, {
          cavaloMecanicoId, implementoIds, justificativaSemImplemento,
        });
        const transferenciasDoConjunto: TransferenciaImplemento[] = before.status === 'ATIVO'
          && status === 'ATIVO' && before.cavaloMecanicoId !== cavaloMecanicoId
          ? before.implementos
            .filter((vinculo: any) => vinculo.dataFim === null && implementoIds.includes(vinculo.implementoId))
            .map((vinculo: any) => ({
              implementoId: vinculo.implementoId,
              placa: vinculo.implemento.placa,
              cavaloMecanicoId: before.cavaloMecanicoId,
              cavaloPlaca: before.cavaloMecanico.placa,
              conjuntoId: before.id,
            }))
          : [];
        if (before.status === 'ATIVO') {
          await this.composicoes.encerrarConjunto(tx, before, timestamp, 'Composição substituída pelo cadastro do conjunto operacional');
        }
        const transferencias = status === 'ATIVO'
          ? await this.prepareActiveComposition(tx, cavaloMecanicoId, implementoIds, timestamp)
          : [];
        // O registro anterior e seus vínculos continuam representando os lançamentos de sua época.
        updated = await this.composicoes.createConjunto(
          tx, cavalo, implementos, status, observacoes || null, timestamp, justificativaSemImplemento || null,
        );
        await this.composicoes.registrarTransferencias(tx, [...transferenciasDoConjunto, ...transferencias], updated, timestamp);
      } else {
        this.validateEmptyComposition(implementoIds, justificativaSemImplemento);
        if (before.status === 'ATIVO' && status !== 'ATIVO') {
          await this.composicoes.encerrarConjunto(tx, before, timestamp, 'Composição encerrada pelo cadastro do conjunto operacional');
        }
        updated = await tx.conjunto.update({
          where: { id },
          data: { status, observacoes, justificativaSemImplemento },
          include: conjuntoInclude,
        });
      }

      await tx.historicoConjuntoOperacional.create({
        data: {
          conjuntoId: updated.id,
          acao: compositionChanged || reactivating ? 'ATUALIZACAO_COMPOSICAO' : 'ATUALIZACAO',
          dadosAntes: this.snapshot(before),
          dadosDepois: this.snapshot(updated),
          observacoes: compositionChanged || reactivating
            ? 'Nova versão da composição; o conjunto anterior e seus lançamentos foram preservados'
            : 'Alteração cadastral do conjunto operacional',
          createdAt: timestamp,
        },
      });
      if (before.cavaloMecanicoId !== updated.cavaloMecanicoId) {
        await this.registrarHistoricoCavalo(tx, before.cavaloMecanicoId, 'DESENGATE_CONJUNTO', before, updated, timestamp);
      }
      await this.registrarHistoricoCavalo(tx, updated.cavaloMecanicoId, 'ATUALIZACAO_ENGATE', before, updated, timestamp);
      return { before, updated };
    });
    await this.audit('ATUALIZACAO', id, result.before, result.updated, actor);
    return result.updated;
  }

  async historico(id: string) {
    await this.findOne(id);
    return this.prisma.historicoConjuntoOperacional.findMany({
      where: { conjuntoId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, actor?: AuditActor) {
    const before = await this.composicoes.runCompositionTransaction<any>(this.prisma, async (tx) => {
      const conjunto = await tx.conjunto.findUnique({ where: { id }, include: conjuntoInclude });
      if (!conjunto) throw new NotFoundException('Registro não encontrado.');
      await this.assertNoRelatedRecords([
        {
          count: tx.lancamentoFinanceiro.count({ where: { conjuntoId: id } }),
          message: 'Não foi possível excluir: conjunto possui lançamentos financeiros vinculados ao histórico.',
        },
        {
          count: tx.historicoConjuntoOperacional.count({ where: { conjuntoId: id } }),
          message: 'Não foi possível excluir: conjunto possui histórico registrado. Inative o cadastro para preservar os dados.',
        },
        {
          count: tx.conjuntoImplemento.count({ where: { conjuntoId: id } }),
          message: 'Não foi possível excluir: conjunto possui vínculos de implementos. Inative o cadastro para preservar os dados.',
        },
        {
          count: tx.caminhao.count({ where: { conjuntoId: id } }),
          message: 'Não foi possível excluir: conjunto está vinculado a um caminhão. Inative o cadastro para preservar os dados.',
        },
      ]);
      await tx.conjunto.delete({ where: { id } });
      return conjunto;
    });
    await this.audit('EXCLUSAO', id, before, null, actor);
    return { message: 'Registro excluído com sucesso.' };
  }

  private async prepareActiveComposition(tx: Prisma.TransactionClient, cavaloMecanicoId: string, implementoIds: string[], timestamp: Date) {
    const activeConjuntos = await tx.conjunto.findMany({
      where: { cavaloMecanicoId, status: 'ATIVO' },
      include: conjuntoInclude,
    });
    for (const conjunto of activeConjuntos) {
      await this.composicoes.encerrarConjunto(tx, conjunto, timestamp, 'Composição substituída pelo cadastro do conjunto operacional');
    }
    return this.composicoes.resolverTransferencias(tx, cavaloMecanicoId, implementoIds, timestamp);
  }

  private async loadComposition(tx: Prisma.TransactionClient, dto: Pick<CreateConjuntoDto, 'cavaloMecanicoId' | 'implementoIds' | 'justificativaSemImplemento'>) {
    if (!dto.cavaloMecanicoId) throw new BadRequestException('Conjunto operacional deve ter um cavalo mecânico.');
    this.validateEmptyComposition(dto.implementoIds, dto.justificativaSemImplemento);
    if (new Set(dto.implementoIds).size !== dto.implementoIds.length) {
      throw new BadRequestException('Não informe o mesmo implemento mais de uma vez na composição.');
    }
    const cavalo = await tx.cavaloMecanico.findUnique({ where: { id: dto.cavaloMecanicoId } });
    if (!cavalo) throw new BadRequestException('Cavalo mecânico não encontrado.');
    const found = await tx.implemento.findMany({ where: { id: { in: dto.implementoIds } } });
    if (found.length !== dto.implementoIds.length) throw new BadRequestException('Um ou mais implementos não foram encontrados.');
    const byId = new Map(found.map((item) => [item.id, item]));
    const implementos = dto.implementoIds.map((implementoId) => byId.get(implementoId)!);
    this.composicoes.validateComposition(implementos, cavalo.tipoCavalo);
    return { cavalo, implementos };
  }

  private validateEmptyComposition(implementoIds: string[], justificativa?: string | null) {
    if ((!implementoIds || implementoIds.length === 0) && !justificativa?.trim()) {
      throw new BadRequestException('Informe pelo menos um implemento ou uma justificativa para conjunto sem implemento.');
    }
  }

  private snapshot(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }

  private async registrarHistoricoCavalo(tx: Prisma.TransactionClient, cavaloMecanicoId: string, acao: string, antes: unknown, depois: unknown, timestamp: Date) {
    await tx.historicoCavaloMecanico.create({
      data: {
        cavaloMecanicoId,
        acao,
        dadosAntes: antes == null ? undefined : this.snapshot(antes),
        dadosDepois: this.snapshot(depois),
        observacoes: 'Histórico de engate do conjunto operacional',
        createdAt: timestamp,
      },
    });
  }
}
