import { Injectable } from '@nestjs/common';
import { TipoLancamento } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private monthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { gte: start, lte: end };
  }

  async resumo() {
    const data = this.monthRange();
    const [faturamento, despesas, cavalosAtivos, implementosAtivos, conjuntosAtivos, motoristasAtivos, ultimosLancamentos, despesasPorCategoria, fluxoMensal, conjuntosPorTipo, manutencao] =
      await Promise.all([
        this.prisma.lancamentoFinanceiro.aggregate({
          where: { data, tipoLancamento: TipoLancamento.FATURAMENTO },
          _sum: { valorTotal: true },
        }),
        this.prisma.lancamentoFinanceiro.aggregate({
          where: { data, tipoLancamento: TipoLancamento.DESPESA },
          _sum: { valorTotal: true },
        }),
        this.prisma.cavaloMecanico.count({ where: { status: 'ATIVO' } }),
        this.prisma.implemento.count({ where: { status: 'ATIVO' } }),
        this.prisma.conjunto.count({ where: { status: 'ATIVO' } }),
        this.prisma.motorista.count({ where: { status: 'ATIVO' } }),
        this.prisma.lancamentoFinanceiro.findMany({
          take: 8,
          orderBy: { data: 'desc' },
          include: { motorista: true, fornecedor: true, cavaloMecanico: true, conjunto: true, cliente: true },
        }),
        this.prisma.lancamentoFinanceiro.groupBy({
          by: ['categoriaId'],
          where: { data, tipoLancamento: TipoLancamento.DESPESA },
          _sum: { valorTotal: true },
        }),
        this.fluxoPorMes(),
        this.prisma.conjunto.groupBy({ by: ['tipo'], where: { status: 'ATIVO' }, _count: { _all: true } }),
        Promise.all([
          this.prisma.cavaloMecanico.count({ where: { status: { in: ['INATIVO', 'MANUTENCAO'] } } }),
          this.prisma.implemento.count({ where: { status: { in: ['INATIVO', 'MANUTENCAO'] } } }),
        ]),
      ]);

    const categoriaIds = despesasPorCategoria.map((item) => item.categoriaId).filter(Boolean) as string[];
    const categorias = categoriaIds.length
      ? await this.prisma.categoriaFinanceira.findMany({ where: { id: { in: categoriaIds } }, select: { id: true, nome: true } })
      : [];
    const categoriasPorId = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));
    const totalFaturadoMes = Number(faturamento._sum.valorTotal || 0);
    const totalDespesasMes = Number(despesas._sum.valorTotal || 0);
    return {
      cards: {
        totalFaturadoMes,
        totalDespesasMes,
        saldoMes: totalFaturadoMes - totalDespesasMes,
        cavalosMecanicosAtivos: cavalosAtivos,
        implementosAtivos,
        conjuntosAtivos,
        itensInativosOuManutencao: manutencao[0] + manutencao[1],
        motoristasAtivos,
      },
      ultimosLancamentos,
      graficos: {
        despesasPorCategoria: despesasPorCategoria.map((item) => ({
          categoria: item.categoriaId ? categoriasPorId.get(item.categoriaId) || 'Sem categoria' : 'Sem categoria',
          total: Number(item._sum.valorTotal || 0),
        })),
        faturamentoPorMes: fluxoMensal.map((item) => ({ mes: item.mes, total: item.faturamento })),
        conjuntosPorTipo: conjuntosPorTipo.map((item) => ({ tipo: item.tipo, total: item._count._all })),
        comparativo: fluxoMensal,
      },
    };
  }

  private async fluxoPorMes() {
    const rows = await this.prisma.$queryRaw<Array<{ mes: Date; tipoLancamento: TipoLancamento; total: unknown }>>`
      SELECT date_trunc('month', data) AS mes, "tipoLancamento", SUM("valorTotal") AS total
      FROM "lancamentos_financeiros"
      WHERE data >= now() - interval '12 months'
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;
    const map = new Map<string, { mes: string; faturamento: number; despesas: number }>();
    for (const row of rows) {
      const mes = row.mes.toISOString().slice(0, 7);
      const item = map.get(mes) || { mes, faturamento: 0, despesas: 0 };
      if (row.tipoLancamento === TipoLancamento.FATURAMENTO) item.faturamento = Number(row.total || 0);
      if (row.tipoLancamento === TipoLancamento.DESPESA) item.despesas = Number(row.total || 0);
      map.set(mes, item);
    }
    return [...map.values()];
  }
}
