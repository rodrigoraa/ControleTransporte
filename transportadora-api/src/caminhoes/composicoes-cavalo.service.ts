import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, TipoCavaloMecanico, TipoConjuntoOperacional, TipoImplemento } from '@prisma/client';

@Injectable()
export class ComposicoesCavaloService {
  async createConjunto(
    tx: any,
    cavalo: { id: string; placa: string; marca: string | null; tipoCavalo?: TipoCavaloMecanico | null },
    implementos: Array<{ id: string; tipo?: TipoImplemento; quantidadeEixos: number; capacidadeCarga: Prisma.Decimal }>,
    status: string,
    observacoes: string | null,
    referenceDate: Date,
  ) {
    this.validateComposition(implementos, cavalo.tipoCavalo);
    const totals = this.calculateTotals(cavalo.tipoCavalo, implementos);
    const composition = this.inferComposition(totals.eixos);
    const conjunto = await tx.conjunto.create({
      data: {
        nome: this.buildNome(cavalo, referenceDate),
        tipo: composition.tipo,
        cavaloMecanicoId: cavalo.id,
        quantidadeTotalEixos: composition.eixos,
        capacidadeTotal: totals.capacidade,
        status,
        observacoes,
        implementos: {
          create: implementos.map((implemento, index) => ({ implementoId: implemento.id, ordem: index + 1 })),
        },
      },
      include: {
        cavaloMecanico: true,
        implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' } },
      },
    });
    await tx.historicoConjuntoOperacional.create({
      data: {
        conjuntoId: conjunto.id,
        acao: 'CRIACAO_COMPOSICAO',
        dadosDepois: JSON.parse(JSON.stringify(conjunto)),
        observacoes: 'Composição criada pelo cadastro do cavalo mecânico',
      },
    });
    return conjunto;
  }

  async runCompositionTransaction<T>(prisma: { $transaction: (callback: (tx: any) => Promise<T>) => Promise<T> }, callback: (tx: any) => Promise<T>) {
    try {
      return await prisma.$transaction(callback);
    } catch (error: any) {
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

  validateComposition(implementos: Array<{ tipo?: TipoImplemento; quantidadeEixos?: number | null }>, tipoCavalo?: TipoCavaloMecanico | null) {
    const hasDolly = implementos.some((item) => item.tipo === TipoImplemento.DOLLY);
    const carretas = implementos.filter((item) => item.tipo !== TipoImplemento.DOLLY);

    if (hasDolly && implementos.every((item) => item.tipo === TipoImplemento.DOLLY)) {
      throw new BadRequestException('Dolly deve estar acompanhado de pelo menos uma carreta, semirreboque ou reboque.');
    }

    if (carretas.length > 2) {
      throw new BadRequestException('A composição deve ter no máximo duas carretas/reboques.');
    }

    if (carretas.length === 1 && hasDolly) {
      throw new BadRequestException('Se houver apenas uma carreta, não informe dolly.');
    }

    if (carretas.length === 2 && !hasDolly) {
      throw new BadRequestException('Se houver segunda carreta, informe dolly.');
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
    return {
      eixos: this.cavaloEixos(tipoCavalo) + implementos.reduce((total, item) => total + (item.tipo === TipoImplemento.DOLLY ? 2 : item.quantidadeEixos), 0),
      capacidade: implementos.reduce((total, item) => total.add(item.capacidadeCarga), new Prisma.Decimal(0)),
    };
  }

  private inferComposition(eixos: number) {
    if (eixos === 9 || eixos === 11) return { tipo: TipoConjuntoOperacional.RODOTREM, eixos };
    if (eixos === 7) return { tipo: TipoConjuntoOperacional.BITREM, eixos };
    if (eixos === 5 || eixos === 6) return { tipo: TipoConjuntoOperacional.SIMPLES, eixos };
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
    return [...[cavalo.placa, cavalo.marca].filter(Boolean), `comp ${referenceDate.getTime()}`].join(' - ');
  }
}




