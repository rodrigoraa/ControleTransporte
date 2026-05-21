import { Injectable } from '@nestjs/common';
import { CategoriaLancamento, TipoLancamento } from '@prisma/client';
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
    const [faturamento, despesas, caminhoesAtivos, motoristasAtivos, ultimosLancamentos, despesasPorCategoria, fluxoMensal, despesasPorCaminhao] =
      await Promise.all([
        this.prisma.lancamentoFinanceiro.aggregate({
          where: { data, tipoLancamento: TipoLancamento.FATURAMENTO },
          _sum: { valorTotal: true },
        }),
        this.prisma.lancamentoFinanceiro.aggregate({
          where: { data, tipoLancamento: TipoLancamento.DESPESA },
          _sum: { valorTotal: true },
        }),
        this.prisma.caminhao.count({ where: { status: 'ATIVO' } }),
        this.prisma.motorista.count({ where: { status: 'ATIVO' } }),
        this.prisma.lancamentoFinanceiro.findMany({
          take: 8,
          orderBy: { data: 'desc' },
          include: { motorista: true, fornecedor: true, caminhao: true, cliente: true },
        }),
        this.prisma.lancamentoFinanceiro.groupBy({
          by: ['categoriaId'],
          where: { data, tipoLancamento: TipoLancamento.DESPESA },
          _sum: { valorTotal: true },
        }),
        this.fluxoPorMes(),
        this.prisma.lancamentoFinanceiro.groupBy({
          by: ['caminhaoId'],
          where: { data, tipoLancamento: TipoLancamento.DESPESA, caminhaoId: { not: null } },
          _sum: { valorTotal: true },
        }),
      ]);

    const totalFaturadoMes = Number(faturamento._sum.valorTotal || 0);
    const totalDespesasMes = Number(despesas._sum.valorTotal || 0);
    return {
      cards: {
        totalFaturadoMes,
        totalDespesasMes,
        saldoMes: totalFaturadoMes - totalDespesasMes,
        caminhoesAtivos,
        motoristasAtivos,
      },
      ultimosLancamentos,
      graficos: {
        despesasPorCategoria: await Promise.all(despesasPorCategoria.map(async (item) => ({
          categoria: item.categoriaId ? (await this.prisma.categoriaFinanceira.findUnique({ where: { id: item.categoriaId } }))?.nome || 'Sem categoria' : 'Sem categoria',
          total: Number(item._sum.valorTotal || 0),
        }))),
        faturamentoPorMes: fluxoMensal.map((item) => ({ mes: item.mes, total: item.faturamento })),
        despesasPorCaminhao,
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
