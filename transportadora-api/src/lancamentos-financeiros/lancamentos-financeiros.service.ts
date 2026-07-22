import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TipoComissao, TipoLancamento, UnidadeQuantidade } from '@prisma/client';
import { AuditActor } from '../common/audit/audit-context';
import { CrudService } from '../common/crud/crud.service';
import { PaginationDto } from '../common/crud/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLancamentoFinanceiroDto } from './dto/create-lancamento-financeiro.dto';
import { UpdateLancamentoFinanceiroDto } from './dto/update-lancamento-financeiro.dto';

const CATEGORIA_COMISSAO = 'COMISSAO_MOTORISTA';

const lancamentoInclude = {
  motorista: true,
  fornecedor: true,
  cavaloMecanico: true,
  conjunto: { include: { cavaloMecanico: true, implementos: { include: { implemento: true } } } },
  implemento: true,
  cliente: true,
  categoriaFinanceira: true,
  faturamentoOrigem: true,
  despesaComissao: true,
};

@Injectable()
export class LancamentosFinanceirosService extends CrudService<CreateLancamentoFinanceiroDto, UpdateLancamentoFinanceiroDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'lancamentoFinanceiro', ['placa', 'descricao'], lancamentoInclude);
  }

  async create(dto: CreateLancamentoFinanceiroDto, actor?: AuditActor) {
    const cleaned = this.cleanData(dto);
    const multiplicarQuantidade = dto.multiplicarQuantidade ?? true;

    const result = await this.prisma.$transaction(async (transaction) => {
      const prepared = await this.prepareData(cleaned, transaction);
      const valorTotal = this.calculateValorTotal(dto.quantidade, dto.valorUnitario, multiplicarQuantidade);
      const comissao = this.calculateCommission(prepared.data, valorTotal, prepared.quantidadeTotalEixos, true);
      const created = await transaction.lancamentoFinanceiro.create({
        data: {
          ...prepared.data,
          ...comissao,
          multiplicarQuantidade,
          valorTotal,
        },
        include: lancamentoInclude,
      });
      const despesaComissao = comissao.valorComissao
        ? await this.createCommissionExpense(transaction, created, comissao.valorComissao)
        : null;
      return { created, despesaComissao };
    });

    await this.audit('CRIACAO', result.created.id, null, result.created, actor);
    if (result.despesaComissao) {
      await this.audit('CRIACAO_COMISSAO', result.despesaComissao.id, null, result.despesaComissao, actor);
    }
    return { ...result.created, despesaComissao: result.despesaComissao };
  }

  protected normalizeUpdate(dto: UpdateLancamentoFinanceiroDto) {
    return dto;
  }

  async update(id: string, dto: UpdateLancamentoFinanceiroDto, actor?: AuditActor) {
    const current = await this.findOne(id);
    if (current.faturamentoOrigemId) {
      throw new BadRequestException('Esta despesa de comissão é automática. Altere o faturamento de origem para recalculá-la.');
    }
    const quantidade = dto.quantidade ?? Number(current.quantidade);
    const valorUnitario = dto.valorUnitario ?? Number(current.valorUnitario);
    const multiplicarQuantidade = dto.multiplicarQuantidade ?? current.multiplicarQuantidade ?? true;
    const data = this.cleanData(dto);
    const partyFields = this.applyBusinessRules({
      tipoLancamento: data.tipoLancamento ?? current.tipoLancamento,
      fornecedorId: data.fornecedorId ?? current.fornecedorId,
      clienteId: data.clienteId ?? current.clienteId,
    });
    const frota = await this.resolveFrotaFields(data, current);
    const valorTotal = this.calculateValorTotal(quantidade, valorUnitario, multiplicarQuantidade);
    const commissionAxlesChanged = current.quantidadeEixosComissao != null
      && Number(current.quantidadeEixosComissao) !== Number(frota.quantidadeTotalEixos || 0);
    const commissionInput = {
      tipoLancamento: data.tipoLancamento ?? current.tipoLancamento,
      tipoComissao: data.tipoComissao === undefined ? current.tipoComissao : data.tipoComissao,
      percentualComissao: data.percentualComissao === undefined
        ? (commissionAxlesChanged ? undefined : current.percentualComissao)
        : data.percentualComissao,
      valorComissaoPorViagem: data.valorComissaoPorViagem === undefined
        ? (commissionAxlesChanged ? undefined : current.valorComissaoPorViagem)
        : data.valorComissaoPorViagem,
    };
    const shouldApplyCommission = Boolean(current.tipoComissao || commissionInput.tipoComissao);
    const comissao = this.calculateCommission(commissionInput, valorTotal, frota.quantidadeTotalEixos, shouldApplyCommission);

    const result = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.lancamentoFinanceiro.update({
        where: { id },
        data: {
          ...data,
          ...comissao,
          placa: frota.placa,
          fornecedorId: partyFields.fornecedorId,
          clienteId: partyFields.clienteId,
          cavaloMecanicoId: frota.cavaloMecanicoId,
          conjuntoId: frota.conjuntoId,
          multiplicarQuantidade,
          valorTotal,
        },
        include: lancamentoInclude,
      });

      let despesaComissao = null;
      if (comissao.valorComissao) {
        despesaComissao = current.despesaComissao
          ? await this.updateCommissionExpense(transaction, current.despesaComissao.id, updated, comissao.valorComissao)
          : await this.createCommissionExpense(transaction, updated, comissao.valorComissao);
      } else if (current.despesaComissao) {
        await transaction.lancamentoFinanceiro.delete({ where: { id: current.despesaComissao.id } });
      }
      return { updated, despesaComissao };
    });

    await this.audit('ATUALIZACAO', id, current, result.updated, actor);
    if (current.despesaComissao || result.despesaComissao) {
      await this.audit(
        current.despesaComissao ? (result.despesaComissao ? 'ATUALIZACAO_COMISSAO' : 'EXCLUSAO_COMISSAO') : 'CRIACAO_COMISSAO',
        result.despesaComissao?.id || current.despesaComissao?.id,
        current.despesaComissao || null,
        result.despesaComissao || null,
        actor,
      );
    }
    return { ...result.updated, despesaComissao: result.despesaComissao };
  }

  private async prepareData(dto: CreateLancamentoFinanceiroDto, database: PrismaService | Prisma.TransactionClient = this.prisma) {
    const data = this.applyBusinessRules(dto);
    const frota = await this.resolveFrotaFields(data, undefined, database);
    return {
      data: {
        ...data,
        placa: frota.placa,
        cavaloMecanicoId: frota.cavaloMecanicoId,
        conjuntoId: frota.conjuntoId,
      },
      quantidadeTotalEixos: frota.quantidadeTotalEixos,
    };
  }

  private cleanData<T extends Record<string, any>>(dto: T): T {
    return Object.fromEntries(
      Object.entries(dto).map(([key, value]) => {
        if (value === '') return [key, null];
        if (key === 'data' && typeof value === 'string') return [key, new Date(`${value}T00:00:00.000Z`)];
        return [key, value];
      }),
    ) as T;
  }

  private async resolveFrotaFields(data: any, current?: any, database: PrismaService | Prisma.TransactionClient = this.prisma) {
    if (data.conjuntoId) {
      const conjunto = await database.conjunto.findUnique({
        where: { id: data.conjuntoId },
        include: { cavaloMecanico: true },
      });
      if (!conjunto) throw new BadRequestException('Conjunto operacional não encontrado. Atualize a página e selecione novamente.');
      return {
        placa: conjunto.cavaloMecanico.placa,
        cavaloMecanicoId: conjunto.cavaloMecanicoId,
        conjuntoId: conjunto.id,
        quantidadeTotalEixos: conjunto.quantidadeTotalEixos,
      };
    }

    const keepsCurrentHorse = current?.cavaloMecanicoId
      && (data.cavaloMecanicoId == null || data.cavaloMecanicoId === current.cavaloMecanicoId);
    if (keepsCurrentHorse) {
      const quantidadeHistorica = current.quantidadeEixosComissao ?? current.conjunto?.quantidadeTotalEixos ?? null;
      if (quantidadeHistorica != null || !data.tipoComissao) {
        return {
          placa: current.placa,
          cavaloMecanicoId: current.cavaloMecanicoId,
          conjuntoId: current.conjuntoId,
          quantidadeTotalEixos: quantidadeHistorica,
        };
      }

      const cavalo = await database.cavaloMecanico.findUnique({
        where: { id: current.cavaloMecanicoId },
        include: {
          conjuntos: {
            where: { status: 'ATIVO' },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!cavalo) throw new BadRequestException('Cavalo mecânico não encontrado. Atualize a página e selecione novamente.');
      const conjunto = cavalo.conjuntos?.[0] || null;
      return {
        placa: cavalo.placa,
        cavaloMecanicoId: cavalo.id,
        conjuntoId: conjunto?.id || null,
        quantidadeTotalEixos: conjunto?.quantidadeTotalEixos ?? null,
      };
    }

    if (data.cavaloMecanicoId) {
      const cavalo = await database.cavaloMecanico.findUnique({
        where: { id: data.cavaloMecanicoId },
        include: {
          conjuntos: {
            where: { status: 'ATIVO' },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!cavalo) throw new BadRequestException('Cavalo mecânico não encontrado. Atualize a página e selecione novamente.');
      const conjunto = cavalo.conjuntos?.[0] || null;
      return {
        placa: cavalo.placa,
        cavaloMecanicoId: cavalo.id,
        conjuntoId: conjunto?.id || null,
        quantidadeTotalEixos: conjunto?.quantidadeTotalEixos ?? null,
      };
    }

    if (data.placa) {
      const cavalo = await database.cavaloMecanico.findUnique({
        where: { placa: data.placa },
        include: {
          conjuntos: {
            where: { status: 'ATIVO' },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!cavalo) throw new BadRequestException('Cavalo mecânico não encontrado para a placa informada.');
      const conjunto = cavalo.conjuntos?.[0] || null;
      return {
        placa: cavalo.placa,
        cavaloMecanicoId: cavalo.id,
        conjuntoId: conjunto?.id || null,
        quantidadeTotalEixos: conjunto?.quantidadeTotalEixos ?? null,
      };
    }

    if (current?.cavaloMecanicoId || current?.placa) {
      return {
        placa: current.placa,
        cavaloMecanicoId: current.cavaloMecanicoId,
        conjuntoId: current.conjuntoId,
        quantidadeTotalEixos: current.quantidadeEixosComissao ?? current.conjunto?.quantidadeTotalEixos ?? null,
      };
    }

    throw new BadRequestException('Informe um conjunto operacional ou um cavalo mecânico para o lançamento.');
  }

  async remove(id: string, actor?: AuditActor) {
    const current = await this.findOne(id);
    if (current.faturamentoOrigemId) {
      throw new BadRequestException('Esta despesa de comissão é automática. Exclua o faturamento de origem para removê-la.');
    }
    const despesaComissao = current.despesaComissao;
    const result = await super.remove(id, actor);
    if (despesaComissao) {
      await this.audit('EXCLUSAO_COMISSAO', despesaComissao.id, despesaComissao, null, actor);
    }
    return result;
  }

  private calculateCommission(data: any, valorTotal: Prisma.Decimal, quantidadeTotalEixos: number | null, applyCommission: boolean) {
    const withoutCommission = {
      tipoComissao: null,
      percentualComissao: null,
      valorComissaoPorViagem: null,
      valorComissao: null,
      quantidadeEixosComissao: null,
    };
    const eixos = Number(quantidadeTotalEixos || 0);
    if (data.tipoLancamento !== TipoLancamento.FATURAMENTO || ![4, 7, 9].includes(eixos) || !applyCommission) {
      return withoutCommission;
    }
    if (!data.tipoComissao) {
      throw new BadRequestException('Selecione o tipo de comissão: percentual ou por viagem.');
    }

    const percentualPadrao = eixos === 9 ? 11 : 12;
    const valorViagemPadrao = eixos === 9 ? 330 : 240;
    const percentual = new Prisma.Decimal(data.percentualComissao ?? percentualPadrao).toDecimalPlaces(2);
    const valorPorViagem = new Prisma.Decimal(data.valorComissaoPorViagem ?? valorViagemPadrao).toDecimalPlaces(2);
    if (!percentual.greaterThan(0) || percentual.greaterThan(100)) {
      throw new BadRequestException('O percentual da comissão deve ser maior que zero e menor ou igual a 100%.');
    }
    if (!valorPorViagem.greaterThan(0)) {
      throw new BadRequestException('O valor da comissão por viagem deve ser maior que zero.');
    }

    const valorComissao = data.tipoComissao === TipoComissao.PERCENTUAL
      ? valorTotal.mul(percentual).div(100).toDecimalPlaces(2)
      : valorPorViagem.toDecimalPlaces(2);

    return {
      tipoComissao: data.tipoComissao as TipoComissao,
      percentualComissao: percentual.toDecimalPlaces(2),
      valorComissaoPorViagem: valorPorViagem.toDecimalPlaces(2),
      valorComissao,
      quantidadeEixosComissao: eixos,
    };
  }

  private async commissionCategory(transaction: Prisma.TransactionClient) {
    return transaction.categoriaFinanceira.upsert({
      where: { codigoSistema: CATEGORIA_COMISSAO },
      update: { tipoLancamento: TipoLancamento.DESPESA, ativo: true },
      create: {
        nome: 'Comissão de motorista',
        codigoSistema: CATEGORIA_COMISSAO,
        tipoLancamento: TipoLancamento.DESPESA,
        ativo: true,
        observacoes: 'Categoria criada automaticamente para despesas de comissão vinculadas aos faturamentos.',
      },
    });
  }

  private commissionExpenseData(faturamento: any, categoriaId: string, valorComissao: Prisma.Decimal) {
    const tipo = faturamento.tipoComissao === TipoComissao.PERCENTUAL
      ? `${faturamento.percentualComissao}%`
      : 'por viagem';
    return {
      data: faturamento.data,
      placa: faturamento.placa,
      motoristaId: faturamento.motoristaId,
      fornecedorId: null,
      caminhaoId: faturamento.caminhaoId,
      cavaloMecanicoId: faturamento.cavaloMecanicoId,
      conjuntoId: faturamento.conjuntoId,
      implementoId: faturamento.implementoId,
      clienteId: null,
      categoriaId,
      tipoLancamento: TipoLancamento.DESPESA,
      descricao: `Comissão de motorista (${tipo}) - ${faturamento.quantidadeEixosComissao} eixos`,
      quantidade: new Prisma.Decimal(1),
      unidadeQuantidade: UnidadeQuantidade.UNIDADE,
      valorUnitario: valorComissao,
      valorTotal: valorComissao,
      multiplicarQuantidade: false,
      observacoes: `Despesa gerada automaticamente pelo faturamento ${faturamento.id}.`,
    };
  }

  private async createCommissionExpense(transaction: Prisma.TransactionClient, faturamento: any, valorComissao: Prisma.Decimal) {
    const categoria = await this.commissionCategory(transaction);
    return transaction.lancamentoFinanceiro.create({
      data: {
        ...this.commissionExpenseData(faturamento, categoria.id, valorComissao),
        faturamentoOrigemId: faturamento.id,
      },
      include: lancamentoInclude,
    });
  }

  private async updateCommissionExpense(transaction: Prisma.TransactionClient, id: string, faturamento: any, valorComissao: Prisma.Decimal) {
    const categoria = await this.commissionCategory(transaction);
    return transaction.lancamentoFinanceiro.update({
      where: { id },
      data: this.commissionExpenseData(faturamento, categoria.id, valorComissao),
      include: lancamentoInclude,
    });
  }

  protected buildWhere(query: PaginationDto & Record<string, any>) {
    const where = super.buildWhere(query);
    if (query.dataInicial || query.dataFinal) {
      where.data = {};
      if (query.dataInicial) where.data.gte = new Date(query.dataInicial);
      if (query.dataFinal) where.data.lte = new Date(query.dataFinal);
    }
    for (const field of ['motoristaId', 'caminhaoId', 'cavaloMecanicoId', 'conjuntoId', 'implementoId', 'fornecedorId', 'clienteId', 'categoriaId']) {
      if (query[field]) where[field] = query[field];
    }
    if (query.tipoLancamento) where.tipoLancamento = query.tipoLancamento as TipoLancamento;
    if (query.placa) where.placa = { contains: query.placa, mode: 'insensitive' };
    return where;
  }

  private applyBusinessRules(data: any) {
    const normalized = { ...data };

    if (normalized.tipoLancamento === TipoLancamento.DESPESA) {
      if (!normalized.fornecedorId) {
        throw new BadRequestException('Despesa deve ter fornecedor. Selecione um fornecedor antes de salvar.');
      }
      normalized.clienteId = null;
    }

    if (normalized.tipoLancamento === TipoLancamento.FATURAMENTO) {
      if (!normalized.clienteId) {
        throw new BadRequestException('Faturamento deve ter cliente. Selecione um cliente antes de salvar.');
      }
      normalized.fornecedorId = null;
    }

    return normalized;
  }

  private calculateValorTotal(quantidade: number, valorUnitario: number, multiplicarQuantidade: boolean) {
    const valor = new Prisma.Decimal(valorUnitario);
    return (multiplicarQuantidade ? new Prisma.Decimal(quantidade).mul(valor) : valor).toDecimalPlaces(2);
  }
}
