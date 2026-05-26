import { Injectable } from '@nestjs/common';
import { TipoLancamento } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RelatorioFinanceiroQueryDto } from './dto/relatorio-financeiro-query.dto';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async opcoes() {
    const [motoristas, cavalos, implementos, conjuntos, fornecedores, clientes, categorias, tipos, placasLancamentos] = await Promise.all([
      this.prisma.motorista.findMany({ select: { id: true, nome: true, cpf: true }, orderBy: { nome: 'asc' } }),
      this.prisma.cavaloMecanico.findMany({ select: { id: true, placa: true, modelo: true, marca: true }, orderBy: { placa: 'asc' } }),
      this.prisma.implemento.findMany({ select: { id: true, placa: true, tipo: true, carroceria: true, quantidadeEixos: true }, orderBy: { placa: 'asc' } }),
      this.prisma.conjunto.findMany({ select: { id: true, nome: true, tipo: true, cavaloMecanicoId: true, quantidadeTotalEixos: true }, orderBy: { nome: 'asc' } }),
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
        distinct: ['placa'],
        select: { placa: true },
        orderBy: { placa: 'asc' },
      }),
    ]);

    const placasCavalos = cavalos.map((cavalo) => cavalo.placa).filter(Boolean);
    const placas = [...new Set([...placasCavalos, ...placasLancamentos.map((item) => item.placa).filter(Boolean)])].sort();

    return {
      motoristas: motoristas.map((item) => ({ value: item.id, label: [item.nome, item.cpf].filter(Boolean).join(' - ') })),
      cavalosMecanicos: cavalos.map((item) => ({
        value: item.id,
        label: [item.placa, item.marca, item.modelo].filter(Boolean).join(' - '),
      })),
      implementos: implementos.map((item) => ({
        value: item.id,
        label: [item.placa, item.tipo, item.carroceria, `${item.quantidadeEixos} eixos`].filter(Boolean).join(' - '),
      })),
      conjuntos: conjuntos.map((item) => ({
        value: item.id,
        label: [item.nome, item.tipo, `${item.quantidadeTotalEixos} eixos`].filter(Boolean).join(' - '),
        cavaloMecanicoId: item.cavaloMecanicoId,
        tipo: item.tipo,
        quantidadeTotalEixos: item.quantidadeTotalEixos,
      })),
      fornecedores: fornecedores.map((item) => ({ value: item.id, label: [item.nome, item.documento].filter(Boolean).join(' - ') })),
      clientes: clientes.map((item) => ({ value: item.id, label: [item.nome, item.documento].filter(Boolean).join(' - ') })),
      categorias: categorias.map((item) => ({ value: item.id, label: [item.nome, item.tipoLancamento].filter(Boolean).join(' - ') })),
      tipos: tipos.map((item) => ({ value: item.tipoLancamento, label: item.tipoLancamento === 'DESPESA' ? 'Despesa' : 'Faturamento' })),
      placas: placas.map((placa) => ({ value: placa, label: placa })),
    };
  }

  private async buildWhere(filters: RelatorioFinanceiroQueryDto) {
    const and: any[] = [];
    if (filters.dataInicial || filters.dataFinal) {
      const data: any = {};
      if (filters.dataInicial) data.gte = new Date(`${filters.dataInicial}T00:00:00.000Z`);
      if (filters.dataFinal) data.lte = new Date(`${filters.dataFinal}T23:59:59.999Z`);
      and.push({ data });
    }
    for (const field of ['motoristaId', 'cavaloMecanicoId', 'conjuntoId', 'fornecedorId', 'clienteId', 'categoriaId'] as const) {
      if (filters[field]) and.push({ [field]: filters[field] });
    }
    if (filters.implementoId) {
      const vinculos = await this.prisma.conjuntoImplemento.findMany({
        where: { implementoId: filters.implementoId },
        select: { conjuntoId: true },
      });
      const conjuntoIds = vinculos.map((item) => item.conjuntoId);
      and.push({
        OR: [
          { implementoId: filters.implementoId },
          ...(conjuntoIds.length ? [{ conjuntoId: { in: conjuntoIds } }] : []),
        ],
      });
    }
    const conjunto: any = {};
    if (filters.tipoConjunto) conjunto.tipo = filters.tipoConjunto;
    if (filters.quantidadeEixos !== undefined) conjunto.quantidadeTotalEixos = filters.quantidadeEixos;
    if (Object.keys(conjunto).length) and.push({ conjunto });
    if (filters.tipoLancamento) and.push({ tipoLancamento: filters.tipoLancamento });
    if (filters.placa) and.push({ placa: { contains: filters.placa, mode: 'insensitive' } });
    return and.length ? { AND: and } : {};
  }

  async financeiros(filters: RelatorioFinanceiroQueryDto) {
    const where = await this.buildWhere(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const orderBy = { [filters.orderBy || 'data']: filters.orderDirection || 'desc' };
    const [despesas, faturamento, total, historico, despesasPorCavaloMecanico, despesasPorMotorista, faturamentoPorCavaloMecanico, faturamentoPorMotorista, conjuntosPorCavalo] =
      await Promise.all([
        this.sum({ ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.sum({ ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.prisma.lancamentoFinanceiro.count({ where }),
        this.prisma.lancamentoFinanceiro.findMany({
          where,
          include: this.lancamentoInclude(),
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.groupWithLabels('cavaloMecanicoId', { ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.groupWithLabels('motoristaId', { ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.groupWithLabels('cavaloMecanicoId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.groupWithLabels('motoristaId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.conjuntosPorCavalo(where),
      ]);

    return {
      totalDespesas: despesas,
      totalFaturamento: faturamento,
      saldoFinal: faturamento - despesas,
      despesasPorCavaloMecanico,
      despesasPorMotorista,
      faturamentoPorCavaloMecanico,
      faturamentoPorMotorista,
      conjuntosPorCavalo,
      historico,
      total,
      page,
      limit,
    };
  }

  async exportarCsv(filters: RelatorioFinanceiroQueryDto) {
    const rows = await this.exportRows(filters);
    const header = [
      'Data',
      'Tipo',
      'Cavalo mecânico',
      'Conjunto operacional',
      'Tipo do conjunto',
      'Eixos do conjunto',
      'Capacidade do conjunto',
      'Implementos do conjunto',
      'Implemento especifico',
      'Motorista',
      'Fornecedor/Cliente',
      'Categoria',
      'Quantidade',
      'Unidade',
      'Valor unitario',
      'Valor total',
    ];
    const body = rows.map((item) => [
      item.data.toISOString().slice(0, 10),
      item.tipoLancamento,
      item.cavaloMecanico?.placa || item.placa,
      item.conjunto?.nome || '',
      item.conjunto?.tipo || '',
      item.conjunto?.quantidadeTotalEixos ?? '',
      item.conjunto?.capacidadeTotal ? String(item.conjunto.capacidadeTotal) : '',
      this.formatImplementosConjunto(item.conjunto),
      item.implemento?.placa || '',
      item.motorista?.nome || '',
      item.fornecedor?.nome || item.cliente?.nome || '',
      item.categoriaFinanceira?.nome || '',
      String(item.quantidade),
      item.unidadeQuantidade,
      String(item.valorUnitario),
      String(item.valorTotal),
    ]);
    return [header, ...body].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
  }

  async exportarPdf(filters: RelatorioFinanceiroQueryDto) {
    const relatorio = await this.financeiros({ ...filters, page: 1, limit: 50 });
    const rows = await this.exportRows(filters);
    const lines = [
      'Relatório financeiro',
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      '',
      'Resumo financeiro',
      `Total de despesas: ${this.formatCurrency(relatorio.totalDespesas)}`,
      `Total de faturamento: ${this.formatCurrency(relatorio.totalFaturamento)}`,
      `Saldo final: ${this.formatCurrency(relatorio.saldoFinal)}`,
      `Total de lançamentos: ${relatorio.total}`,
      '',
      'Lancamentos encontrados',
      'Data | Placa | Valor unitario | Valor total',
      ...(rows.length
        ? rows.map((item) => `${this.formatDate(item.data)} | ${item.cavaloMecanico?.placa || item.placa || '-'} | ${this.formatCurrency(item.valorUnitario)} | ${this.formatCurrency(item.valorTotal)}`)
        : ['Nenhum lançamento encontrado para os filtros informados.']),
      '',
      'Despesas por cavalo mecânico',
      ...this.formatPdfGroup(relatorio.despesasPorCavaloMecanico),
      '',
      'Despesas por motorista',
      ...this.formatPdfGroup(relatorio.despesasPorMotorista),
      '',
      'Faturamento por cavalo mecânico',
      ...this.formatPdfGroup(relatorio.faturamentoPorCavaloMecanico),
      '',
      'Faturamento por motorista',
      ...this.formatPdfGroup(relatorio.faturamentoPorMotorista),
      '',
      'Resumo por composição do cavalo',
      ...(relatorio.conjuntosPorCavalo.length
        ? relatorio.conjuntosPorCavalo.map((item: any) =>
            [
              item.cavalo || '-',
              item.conjunto || '-',
              item.tipoConjunto || '-',
              item.quantidadeTotalEixos != null ? `${item.quantidadeTotalEixos} eixos` : '-',
              `${item.quantidadeLancamentos} lanc.`,
              `Desp. ${this.formatCurrency(item.totalDespesas)}`,
              `Fat. ${this.formatCurrency(item.totalFaturamento)}`,
              `Saldo ${this.formatCurrency(item.saldo)}`,
            ].join(' | '),
          )
        : ['Nenhum conjunto encontrado para os filtros informados.']),
    ];
    return this.simplePdf(lines);
  }

  private async exportRows(filters: RelatorioFinanceiroQueryDto) {
    return this.prisma.lancamentoFinanceiro.findMany({
      where: await this.buildWhere(filters),
      include: this.lancamentoInclude(),
      orderBy: { [filters.orderBy || 'data']: filters.orderDirection || 'desc' },
      take: 5000,
    });
  }

  private lancamentoInclude() {
    return {
      motorista: true,
      fornecedor: true,
      cliente: true,
      categoriaFinanceira: true,
      cavaloMecanico: true,
      implemento: true,
      conjunto: {
        include: {
          implementos: {
            include: { implemento: true },
            orderBy: { ordem: 'asc' as const },
          },
        },
      },
    };
  }

  private simplePdf(lines: string[]) {
    const wrappedLines = lines.flatMap((line) => this.wrapPdfLine(line));
    const linesPerPage = 52;
    const pages: string[][] = [];
    for (let index = 0; index < wrappedLines.length; index += linesPerPage) {
      pages.push(wrappedLines.slice(index, index + linesPerPage));
    }
    if (!pages.length) pages.push([]);

    const fontObjectId = 3 + pages.length * 2;
    const pageObjectIds = pages.map((_, index) => 3 + index * 2);
    const contentObjectIds = pages.map((_, index) => 4 + index * 2);
    const objects = [
      `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
      `2 0 obj << /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >> endobj`,
      ...pages.flatMap((pageLines, index) => {
        const content = pageLines.map((line, lineIndex) => `BT /F1 10 Tf 40 ${780 - lineIndex * 14} Td (${this.escapePdfText(line)}) Tj ET`).join('\n');
        return [
          `${pageObjectIds[index]} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >> endobj`,
          `${contentObjectIds[index]} 0 obj << /Length ${Buffer.byteLength(content, 'latin1')} >> stream\n${content}\nendstream endobj`,
        ];
      }),
      `${fontObjectId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${object}\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
  }

  private wrapPdfLine(line: string) {
    const normalized = this.normalizePdfText(line);
    if (normalized.length <= 105) return [normalized];
    const parts: string[] = [];
    let current = '';
    for (const word of normalized.split(' ')) {
      if (`${current} ${word}`.trim().length > 105) {
        parts.push(current);
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }
    if (current) parts.push(current);
    return parts;
  }

  private escapePdfText(line: string) {
    return this.normalizePdfText(line).replace(/[()\\]/g, '\\$&');
  }

  private normalizePdfText(line: string) {
    return String(line).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '-');
  }

  private formatPdfGroup(rows: Array<{ label: string; total: number }>) {
    return rows.length ? rows.map((row) => `${row.label || 'Sem cadastro'} | ${this.formatCurrency(row.total)}`) : ['Nenhum registro encontrado.'];
  }

  private formatCurrency(value: unknown) {
    return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private formatDate(value: Date) {
    return value.toISOString().slice(0, 10).split('-').reverse().join('/');
  }

  private async sum(where: any) {
    const result = await this.prisma.lancamentoFinanceiro.aggregate({ where, _sum: { valorTotal: true } });
    return Number(result._sum.valorTotal || 0);
  }

  private async group(by: 'cavaloMecanicoId' | 'motoristaId', where: any) {
    const groupWhere = by === 'cavaloMecanicoId' ? { ...where, [by]: { not: null } } : where;
    return this.prisma.lancamentoFinanceiro.groupBy({
      by: [by],
      where: groupWhere,
      _sum: { valorTotal: true },
    });
  }

  private async groupWithLabels(by: 'cavaloMecanicoId' | 'motoristaId', where: any) {
    const rows = await this.group(by, where);
    const ids = rows.map((row) => row[by]).filter(Boolean) as string[];

    const labels = new Map<string, string>();
    if (by === 'cavaloMecanicoId') {
      const cavalos = await this.prisma.cavaloMecanico.findMany({
        where: { id: { in: ids } },
        select: { id: true, placa: true, marca: true, modelo: true },
      });
      cavalos.forEach((item) => labels.set(item.id, [item.placa, item.marca, item.modelo].filter(Boolean).join(' - ')));
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

  private async conjuntosPorCavalo(where: any) {
    const lancamentos = await this.prisma.lancamentoFinanceiro.findMany({
      where: { ...where, cavaloMecanicoId: { not: null } },
      include: this.lancamentoInclude(),
      orderBy: { data: 'desc' },
      take: 5000,
    });

    const mapa = new Map<string, any>();
    for (const item of lancamentos) {
      const cavaloId = item.cavaloMecanicoId || 'sem-cavalo';
      const conjuntoId = item.conjuntoId || 'sem-conjunto';
      const key = `${cavaloId}:${conjuntoId}`;
      if (!mapa.has(key)) {
        mapa.set(key, {
          cavaloId,
          cavalo: item.cavaloMecanico ? [item.cavaloMecanico.placa, item.cavaloMecanico.marca, item.cavaloMecanico.modelo].filter(Boolean).join(' - ') : item.placa,
          conjuntoId: item.conjuntoId,
          conjunto: item.conjunto?.nome || 'Sem conjunto operacional',
          tipoConjunto: item.conjunto?.tipo || null,
          quantidadeTotalEixos: item.conjunto?.quantidadeTotalEixos ?? null,
          capacidadeTotal: item.conjunto?.capacidadeTotal ? Number(item.conjunto.capacidadeTotal) : 0,
          implementos: this.formatImplementosConjunto(item.conjunto),
          quantidadeLancamentos: 0,
          totalDespesas: 0,
          totalFaturamento: 0,
          saldo: 0,
        });
      }
      const row = mapa.get(key);
      const valor = Number(item.valorTotal || 0);
      row.quantidadeLancamentos += 1;
      if (item.tipoLancamento === TipoLancamento.DESPESA) row.totalDespesas += valor;
      if (item.tipoLancamento === TipoLancamento.FATURAMENTO) row.totalFaturamento += valor;
      row.saldo = row.totalFaturamento - row.totalDespesas;
    }

    return [...mapa.values()];
  }

  private formatConjuntoResumo(conjunto: any) {
    if (!conjunto) return '-';
    return [conjunto.nome, conjunto.tipo, conjunto.quantidadeTotalEixos != null ? `${conjunto.quantidadeTotalEixos} eixos` : null, this.formatImplementosConjunto(conjunto)]
      .filter(Boolean)
      .join(' | ');
  }

  private formatImplementosConjunto(conjunto: any) {
    const implementos = conjunto?.implementos || [];
    if (!implementos.length) return '';
    return implementos
      .map((vinculo: any) => {
        const implemento = vinculo.implemento;
        return [vinculo.ordem ? `${vinculo.ordem}.` : null, implemento?.placa || 'Sem placa', implemento?.tipo, implemento?.carroceria, implemento?.quantidadeEixos != null ? `${implemento.quantidadeEixos} eixos` : null]
          .filter(Boolean)
          .join(' ');
      })
      .join(' / ');
  }
}






