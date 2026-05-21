import { Injectable } from '@nestjs/common';
import { TipoLancamento } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async opcoes() {
    const [motoristas, caminhoes, fornecedores, clientes, categorias, tipos, placasLancamentos] = await Promise.all([
      this.prisma.motorista.findMany({ select: { id: true, nome: true, cpf: true }, orderBy: { nome: 'asc' } }),
      this.prisma.caminhao.findMany({ select: { id: true, placa: true, modelo: true, marca: true }, orderBy: { placa: 'asc' } }),
      this.prisma.fornecedor.findMany({ select: { id: true, nome: true, documento: true }, orderBy: { nome: 'asc' } }),
      this.prisma.cliente.findMany({ select: { id: true, nome: true, documento: true }, orderBy: { nome: 'asc' } }),
      this.prisma.categoriaFinanceira.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, tipoLancamento: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.lancamentoFinanceiro.findMany({
        distinct: ['tipoLancamento'],
        select: { tipoLancamento: true },
        orderBy: { tipoLancamento: 'asc' },
      }),
      this.prisma.lancamentoFinanceiro.findMany({
        distinct: ['placaOuPessoa'],
        select: { placaOuPessoa: true },
        orderBy: { placaOuPessoa: 'asc' },
      }),
    ]);

    const placasCaminhoes = caminhoes.map((caminhao) => caminhao.placa).filter(Boolean);
    const placas = [...new Set([...placasCaminhoes, ...placasLancamentos.map((item) => item.placaOuPessoa).filter(Boolean)])].sort();

    return {
      motoristas: motoristas.map((item) => ({ value: item.id, label: [item.nome, item.cpf].filter(Boolean).join(' - ') })),
      caminhoes: caminhoes.map((item) => ({ value: item.id, label: [item.placa, item.marca, item.modelo].filter(Boolean).join(' - ') })),
      fornecedores: fornecedores.map((item) => ({ value: item.id, label: [item.nome, item.documento].filter(Boolean).join(' - ') })),
      clientes: clientes.map((item) => ({ value: item.id, label: [item.nome, item.documento].filter(Boolean).join(' - ') })),
      categorias: categorias.map((item) => ({ value: item.id, label: [item.nome, item.tipoLancamento].filter(Boolean).join(' - ') })),
      tipos: tipos.map((item) => ({ value: item.tipoLancamento, label: item.tipoLancamento === 'DESPESA' ? 'Despesa' : 'Faturamento' })),
      placas: placas.map((placa) => ({ value: placa, label: placa })),
    };
  }

  private buildWhere(filters: Record<string, string>) {
    const where: any = {};
    if (filters.dataInicial || filters.dataFinal) {
      where.data = {};
      if (filters.dataInicial) where.data.gte = new Date(filters.dataInicial);
      if (filters.dataFinal) where.data.lte = new Date(filters.dataFinal);
    }
    for (const field of ['motoristaId', 'caminhaoId', 'fornecedorId', 'clienteId', 'categoriaId']) {
      if (filters[field]) where[field] = filters[field];
    }
    if (filters.tipoLancamento) where.tipoLancamento = filters.tipoLancamento;
    if (filters.placa) where.placaOuPessoa = { contains: filters.placa, mode: 'insensitive' };
    return where;
  }

  async financeiros(filters: Record<string, string>) {
    const where = this.buildWhere(filters);
    const [despesas, faturamento, historico, despesasPorCaminhao, despesasPorMotorista, faturamentoPorCaminhao, faturamentoPorMotorista] =
      await Promise.all([
        this.sum({ ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.sum({ ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.prisma.lancamentoFinanceiro.findMany({
          where,
          include: { motorista: true, fornecedor: true, caminhao: true, cliente: true, categoriaFinanceira: true },
          orderBy: { data: 'desc' },
          take: 500,
        }),
        this.groupWithLabels('caminhaoId', { ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.groupWithLabels('motoristaId', { ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.groupWithLabels('caminhaoId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.groupWithLabels('motoristaId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
      ]);

    return {
      totalDespesas: despesas,
      totalFaturamento: faturamento,
      saldoFinal: faturamento - despesas,
      despesasPorCaminhao,
      despesasPorMotorista,
      faturamentoPorCaminhao,
      faturamentoPorMotorista,
      historico,
    };
  }

  async acompanhamentos(filters: Record<string, string>) {
    const where: any = {};
    if (filters.caminhaoId) where.caminhaoId = filters.caminhaoId;
    if (filters.motoristaId) where.motoristaId = filters.motoristaId;
    if (filters.status) where.status = filters.status;
    const historico = await this.prisma.acompanhamento.findMany({
      where,
      include: { caminhao: true, motorista: true },
      orderBy: { dataInicio: 'desc' },
    });
    return {
      historico,
      porCaminhao: await this.prisma.acompanhamento.groupBy({ by: ['caminhaoId'], where, _count: true }),
      caminhoesPorMotorista: await this.prisma.acompanhamento.groupBy({ by: ['motoristaId'], where, _count: true }),
    };
  }

  private async sum(where: any) {
    const result = await this.prisma.lancamentoFinanceiro.aggregate({ where, _sum: { valorTotal: true } });
    return Number(result._sum.valorTotal || 0);
  }

  private async group(by: 'caminhaoId' | 'motoristaId', where: any) {
    const groupWhere = by === 'caminhaoId' ? { ...where, [by]: { not: null } } : where;
    return this.prisma.lancamentoFinanceiro.groupBy({
      by: [by],
      where: groupWhere,
      _sum: { valorTotal: true },
    });
  }

  private async groupWithLabels(by: 'caminhaoId' | 'motoristaId', where: any) {
    const rows = await this.group(by, where);
    const ids = rows.map((row) => row[by]).filter(Boolean) as string[];

    const labels = new Map<string, string>();
    if (by === 'caminhaoId') {
      const caminhoes = await this.prisma.caminhao.findMany({
        where: { id: { in: ids } },
        select: { id: true, placa: true, marca: true, modelo: true },
      });
      caminhoes.forEach((item) => labels.set(item.id, [item.placa, item.marca, item.modelo].filter(Boolean).join(' - ')));
    } else {
      const motoristas = await this.prisma.motorista.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true, cpf: true },
      });
      motoristas.forEach((item) => labels.set(item.id, [item.nome, item.cpf].filter(Boolean).join(' - ')));
    }

    return rows.map((row) => ({
      id: row[by],
      label: labels.get(row[by] || '') || 'Sem cadastro',
      total: Number(row._sum.valorTotal || 0),
    }));
  }
}
