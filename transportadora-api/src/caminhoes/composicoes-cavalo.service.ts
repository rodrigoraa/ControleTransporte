import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, StatusGeral, TipoCavaloMecanico, TipoConjuntoOperacional, TipoImplemento } from '@prisma/client';

const composicaoInclude = {
  cavaloMecanico: true,
  implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' as const } },
} satisfies Prisma.ConjuntoInclude;

type Composicao = Prisma.ConjuntoGetPayload<{ include: typeof composicaoInclude }>;

export type TransferenciaImplemento = {
  implementoId: string;
  placa: string | null;
  cavaloMecanicoId: string;
  cavaloPlaca: string;
  conjuntoId: string;
};

@Injectable()
export class ComposicoesCavaloService {
  async createConjunto(
    tx: Prisma.TransactionClient,
    cavalo: { id: string; placa: string; marca: string | null; tipoCavalo?: TipoCavaloMecanico | null },
    implementos: Array<{ id: string; tipo?: TipoImplemento; quantidadeEixos: number; capacidadeCarga: Prisma.Decimal }>,
    status: StatusGeral,
    observacoes: string | null,
    referenceDate: Date,
    justificativaSemImplemento: string | null = null,
  ) {
    this.validateComposition(implementos, cavalo.tipoCavalo);
    if (status === StatusGeral.ATIVO) {
      // Predicate reads also protect concurrent inserts when executed at Serializable.
      const conflito = await tx.conjunto.findFirst({
        where: {
          status: StatusGeral.ATIVO,
          OR: [
            { cavaloMecanicoId: cavalo.id },
            { implementos: { some: { implementoId: { in: implementos.map((item) => item.id) }, dataFim: null } } },
          ],
        },
        select: { id: true },
      });
      if (conflito) throw new ConflictException('Cavalo ou implemento já possui uma composição ativa. Atualize a página e tente novamente.');
    }
    const totals = this.calculateTotals(cavalo.tipoCavalo, implementos);
    const composition = this.inferComposition(totals.eixos, implementos);
    const conjunto = await tx.conjunto.create({
      data: {
        nome: this.buildNome(cavalo, referenceDate),
        tipo: composition.tipo,
        cavaloMecanicoId: cavalo.id,
        quantidadeTotalEixos: composition.eixos,
        capacidadeTotal: totals.capacidade,
        status,
        observacoes,
        justificativaSemImplemento,
        implementos: {
          create: implementos.map((implemento, index) => ({
            implementoId: implemento.id,
            ordem: index + 1,
            dataInicio: referenceDate,
            dataFim: status === StatusGeral.ATIVO ? null : referenceDate,
          })),
        },
      },
      include: composicaoInclude,
    });
    await tx.historicoConjuntoOperacional.create({
      data: {
        conjuntoId: conjunto.id,
        acao: 'CRIACAO_COMPOSICAO',
        dadosDepois: JSON.parse(JSON.stringify(conjunto)),
        observacoes: 'Composição criada pelo cadastro do cavalo mecânico',
        createdAt: referenceDate,
      },
    });
    return conjunto;
  }

  async runCompositionTransaction<T>(prisma: Pick<PrismaClient, '$transaction'>, callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let tentativa = 0; ; tentativa++) {
      try {
        return await prisma.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 20_000,
        });
      } catch (error: any) {
        if (error?.code === 'P2034') {
          if (tentativa < 3) continue;
          throw new ConflictException('A composição foi alterada por outra operação. Atualize a página e tente novamente.');
        }
        if (error?.code === 'P2002') {
          const fields = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : 'campo único';
          throw new ConflictException(`Já existe um registro cadastrado com este valor em: ${fields}. Verifique placas e dados únicos.`);
        }
        if (error?.code === 'P2003') {
          throw new BadRequestException('Registro relacionado não encontrado. Atualize a página e selecione novamente.');
        }
        throw error;
      }
    }
  }

  async encerrarConjunto(tx: Prisma.TransactionClient, conjunto: { id: string }, referenceDate: Date, observacoes: string) {
    // Read the snapshot before closing links; keep all composition and financial fields.
    const antes = await tx.conjunto.findUniqueOrThrow({ where: { id: conjunto.id }, include: composicaoInclude });
    const dadosAntes = this.snapshot(antes);
    await tx.conjuntoImplemento.updateMany({
      where: { conjuntoId: conjunto.id, dataFim: null },
      data: { dataFim: referenceDate },
    });
    const depois = await tx.conjunto.update({
      where: { id: conjunto.id },
      data: { status: StatusGeral.INATIVO },
      include: composicaoInclude,
    });
    await tx.historicoConjuntoOperacional.create({
      data: {
        conjuntoId: conjunto.id,
        acao: 'ENCERRAMENTO_COMPOSICAO',
        dadosAntes,
        dadosDepois: this.snapshot(depois),
        observacoes,
        createdAt: referenceDate,
      },
    });
    return depois;
  }

  async resolverTransferencias(tx: Prisma.TransactionClient, cavaloMecanicoId: string, implementoIds: string[], referenceDate: Date): Promise<TransferenciaImplemento[]> {
    if (!implementoIds.length) return [];
    const anteriores = await tx.conjunto.findMany({
      where: {
        status: StatusGeral.ATIVO,
        cavaloMecanicoId: { not: cavaloMecanicoId },
        implementos: { some: { implementoId: { in: implementoIds }, dataFim: null } },
      },
      include: composicaoInclude,
      orderBy: { id: 'asc' },
    });
    const selecionados = new Set(implementoIds);
    const transferencias: TransferenciaImplemento[] = [];
    for (const anterior of anteriores) {
      const ativos = anterior.implementos.filter((vinculo) => vinculo.dataFim === null);
      const transferidos = ativos.filter((vinculo) => selecionados.has(vinculo.implementoId));
      const restantes = ativos.filter((vinculo) => !selecionados.has(vinculo.implementoId)).map((vinculo) => vinculo.implemento);
      await this.encerrarConjunto(tx, anterior, referenceDate, 'Composição encerrada por transferência de implementos para outro cavalo mecânico');

      let remanescente: Composicao | null = null;
      let motivoSemComposicao: string | null = restantes.length ? null : 'Nenhum implemento restante';
      if (restantes.length) {
        // Invalid leftovers are released; operational errors must still abort the transaction.
        try {
          this.validateComposition(restantes, anterior.cavaloMecanico.tipoCavalo);
        } catch (error) {
          if (!(error instanceof BadRequestException)) throw error;
          motivoSemComposicao = error.message;
        }
        if (!motivoSemComposicao) {
          remanescente = await this.createConjunto(tx, anterior.cavaloMecanico, restantes, StatusGeral.ATIVO, anterior.observacoes, referenceDate);
        }
      }
      await tx.historicoCavaloMecanico.create({
        data: {
          cavaloMecanicoId: anterior.cavaloMecanicoId,
          acao: 'DESENGATE_IMPLEMENTO',
          dadosAntes: this.snapshot(anterior),
          dadosDepois: this.snapshot({
            cavaloMecanicoId: anterior.cavaloMecanicoId,
            cavaloDestinoId: cavaloMecanicoId,
            conjunto: remanescente,
            implementoIdsTransferidos: transferidos.map((item) => item.implementoId),
            motivoSemComposicao,
          }),
          observacoes: motivoSemComposicao ? `Transferência de implementos; cavalo sem composição ativa: ${motivoSemComposicao}` : 'Transferência de implementos; composição restante recalculada',
          createdAt: referenceDate,
        },
      });
      transferencias.push(...transferidos.map((vinculo) => ({
        implementoId: vinculo.implementoId,
        placa: vinculo.implemento.placa,
        cavaloMecanicoId: anterior.cavaloMecanicoId,
        cavaloPlaca: anterior.cavaloMecanico.placa,
        conjuntoId: anterior.id,
      })));
    }
    return transferencias;
  }

  async registrarTransferencias(tx: Prisma.TransactionClient, transferencias: TransferenciaImplemento[], conjunto: Composicao, referenceDate: Date) {
    for (const transferencia of transferencias) {
      await tx.historicoImplemento.create({
        data: {
          implementoId: transferencia.implementoId,
          acao: 'TRANSFERENCIA_IMPLEMENTO',
          dadosAntes: this.snapshot({ ...transferencia, dataHora: referenceDate }),
          dadosDepois: this.snapshot({
            implementoId: transferencia.implementoId,
            placa: transferencia.placa,
            cavaloMecanicoId: conjunto.cavaloMecanicoId,
            cavaloPlaca: conjunto.cavaloMecanico.placa,
            conjuntoId: conjunto.id,
            status: conjunto.status,
            dataHora: referenceDate,
          }),
          observacoes: `Implemento transferido de ${transferencia.cavaloPlaca} para ${conjunto.cavaloMecanico.placa}`,
          createdAt: referenceDate,
        },
      });
    }
  }

  private snapshot(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value));
  }

  validateComposition(implementos: Array<{ id?: string; tipo?: TipoImplemento; quantidadeEixos?: number | null }>, tipoCavalo?: TipoCavaloMecanico | null) {
    const ids = implementos.flatMap((item) => item.id ? [item.id] : []);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Um implemento não pode aparecer mais de uma vez na composição.');
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

    if (hasDolly && !this.isThreeAxleCavalo(tipoCavalo)) {
      throw new BadRequestException('Rodotrem deve usar cavalo trucado ou traçado.');
    }

    if (carretas.some((item) => ![2, 3].includes(Number(item.quantidadeEixos)))) {
      throw new BadRequestException('Carretas devem ter 2 ou 3 eixos.');
    }
  }

  normalizeImplementoEixos(implemento: { tipo: TipoImplemento; quantidadeEixos?: number | null }) {
    if (implemento.tipo === TipoImplemento.DOLLY) return 2;
    return implemento.quantidadeEixos ?? 2;
  }

  private calculateTotals(tipoCavalo: TipoCavaloMecanico | null | undefined, implementos: Array<{ tipo?: TipoImplemento; quantidadeEixos: number; capacidadeCarga: Prisma.Decimal }>) {
    if (!implementos.length) return { eixos: 0, capacidade: new Prisma.Decimal(0) };
    return {
      eixos: this.cavaloEixos(tipoCavalo) + implementos.reduce((total, item) => total + (item.tipo === TipoImplemento.DOLLY ? 2 : item.quantidadeEixos), 0),
      capacidade: implementos.reduce((total, item) => total.add(item.capacidadeCarga), new Prisma.Decimal(0)),
    };
  }

  private inferComposition(eixos: number, implementos: Array<{ tipo?: TipoImplemento }>) {
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

  private buildNome(cavalo: { placa: string; marca: string | null }, referenceDate = new Date()) {
    return [...[cavalo.placa, cavalo.marca].filter(Boolean), `comp ${referenceDate.getTime()}-${randomUUID()}`].join(' - ');
  }
}




