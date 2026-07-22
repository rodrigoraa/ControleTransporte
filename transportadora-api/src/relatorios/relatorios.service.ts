import { Injectable } from '@nestjs/common';
import { TipoLancamento } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RelatorioFinanceiroQueryDto } from './dto/relatorio-financeiro-query.dto';

type PdfTextOptions = {
  size?: number;
  font?: 'regular' | 'bold';
  color?: [number, number, number];
  align?: 'left' | 'right' | 'center';
};

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

  private buildAbastecimentoWhere(filters: RelatorioFinanceiroQueryDto) {
    const where: any = {};
    if (filters.dataInicial || filters.dataFinal) {
      where.data = {};
      if (filters.dataInicial) where.data.gte = new Date(`${filters.dataInicial}T00:00:00.000Z`);
      if (filters.dataFinal) where.data.lte = new Date(`${filters.dataFinal}T23:59:59.999Z`);
    }
    if (filters.cavaloMecanicoId) where.cavaloMecanicoId = filters.cavaloMecanicoId;
    if (filters.placa) where.cavaloMecanico = { placa: { contains: filters.placa, mode: 'insensitive' } };
    return where;
  }

  async financeiros(filters: RelatorioFinanceiroQueryDto) {
    const where = await this.buildWhere(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const orderBy = { [filters.orderBy || 'data']: filters.orderDirection || 'desc' };
    const [despesas, faturamento, total, historico, despesasPorCavaloMecanico, despesasPorMotorista, faturamentoPorCavaloMecanico, faturamentoPorMotorista, conjuntosPorCavalo, consumo, comissoes] =
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
        this.consumo(filters),
        this.comissoes(filters),
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
      consumo,
      comissoes,
      historico,
      total,
      page,
      limit,
    };
  }

  async exportarCsv(filters: RelatorioFinanceiroQueryDto) {
    const [rows, consumo, comissoes] = await Promise.all([
      this.exportRows(filters),
      this.consumo(filters, 5000),
      this.comissoes(filters, 5000),
    ]);
    const header = [
      'Data',
      'Tipo',
      'Cavalo mecânico',
      'Conjunto operacional',
      'Tipo do conjunto',
      'Eixos do conjunto',
      'Capacidade do conjunto',
      'Implementos do conjunto',
      'Implemento específico',
      'Motorista',
      'Fornecedor/Cliente',
      'Categoria',
      'Quantidade',
      'Unidade',
      'Valor unitário',
      'Valor total',
      'Tipo de comissão',
      'Eixos da comissão',
      'Percentual de comissão',
      'Comissão por viagem',
      'Valor da comissão',
      'Faturamento de origem',
    ];
    const body = rows.map((item) => {
      const faturamentoComissao = item.tipoComissao ? item : null;
      return [
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
        this.commissionTypeLabel(faturamentoComissao?.tipoComissao),
        faturamentoComissao?.quantidadeEixosComissao ?? '',
        faturamentoComissao?.percentualComissao != null ? String(faturamentoComissao.percentualComissao) : '',
        faturamentoComissao?.valorComissaoPorViagem != null ? String(faturamentoComissao.valorComissaoPorViagem) : '',
        faturamentoComissao?.valorComissao != null ? String(faturamentoComissao.valorComissao) : '',
        item.faturamentoOrigemId || '',
      ];
    });
    const resumoComissoes = comissoes.resumo;
    const comissoesBody = comissoes.historico.map((item: any) => [
      item.data.toISOString().slice(0, 10),
      item.cavaloMecanico?.placa || item.placa || '',
      item.motorista?.nome || '',
      String(item.quantidadeEixosComissao),
      this.commissionTypeLabel(item.tipoComissao),
      this.commissionRuleLabel(item),
      String(item.valorTotal),
      String(item.valorComissao),
      (Number(item.valorTotal) - Number(item.valorComissao)).toFixed(2),
    ]);
    const consumoHeader = ['Data', 'Cavalo mecânico', 'Km anterior', 'Km atual', 'Distância percorrida', 'Litros', 'Média km/l', 'Observações'];
    const consumoBody = consumo.historico.map((item: any) => [
      item.data.toISOString().slice(0, 10),
      [item.cavaloMecanico?.placa, item.cavaloMecanico?.marca, item.cavaloMecanico?.modelo].filter(Boolean).join(' - '),
      String(item.kmAnterior),
      String(item.kmAtual),
      String(item.distanciaPercorrida),
      String(item.litros),
      String(item.mediaKmLitro),
      item.observacoes || '',
    ]);
    const resumoConsumo = consumo.porCavalo.map((item: any) => [
      item.cavalo,
      String(item.quantidadeRegistros),
      String(item.distanciaTotal),
      String(item.litrosTotal),
      String(item.mediaGeralKmLitro),
    ]);
    const csvRows = [
      header,
      ...body,
      [],
      ['Resumo de comissões dos faturamentos'],
      ['Viagens com comissão', 'Faturamento relacionado', 'Total de comissões', 'Faturamento após comissões'],
      [
        String(resumoComissoes.quantidade),
        String(resumoComissoes.totalFaturado),
        String(resumoComissoes.totalComissoes),
        String(resumoComissoes.faturamentoAposComissoes),
      ],
      [],
      ['Histórico de comissões'],
      ['Data', 'Cavalo mecânico', 'Motorista', 'Eixos', 'Tipo', 'Regra', 'Faturamento', 'Comissão', 'Após comissão'],
      ...comissoesBody,
      [],
      ['Resumo de consumo por cavalo'],
      ['Cavalo mecânico', 'Abastecimentos', 'Distância total', 'Litros registrados', 'Média geral km/l'],
      ...resumoConsumo,
      [],
      ['Histórico de abastecimentos'],
      consumoHeader,
      ...consumoBody,
    ];
    return csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
  }

  async exportarPdf(filters: RelatorioFinanceiroQueryDto) {
    const [relatorio, rows, consumo, comissoes] = await Promise.all([
      this.financeiros({ ...filters, page: 1, limit: 50 }),
      this.exportRows(filters),
      this.consumo(filters, 5000),
      this.comissoes(filters, 5000),
    ]);
    relatorio.consumo = consumo;
    relatorio.comissoes = comissoes;
    return this.styledFinancialPdf(relatorio, rows);
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
      faturamentoOrigem: true,
      despesaComissao: true,
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

  private styledFinancialPdf(relatorio: any, rows: any[]) {
    const pages: string[][] = [[]];
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 36;
    let y = pageHeight - margin;

    const current = () => pages[pages.length - 1];
    const add = (command: string) => current().push(command);
    const rgb = (color: [number, number, number]) => color.map((value) => (value / 255).toFixed(3)).join(' ');
    const rect = (x: number, top: number, width: number, height: number, color: [number, number, number]) => {
      add(`q ${rgb(color)} rg ${x} ${top - height} ${width} ${height} re f Q`);
    };
    const textWidth = (value: string, size: number) => this.normalizePdfText(value).length * size * 0.52;
    const text = (value: string, x: number, baseline: number, options: PdfTextOptions = {}) => {
      const size = options.size || 10;
      const color = options.color || [32, 40, 48];
      const font = options.font === 'bold' ? 'F2' : 'F1';
      let tx = x;
      if (options.align === 'right') tx = x - textWidth(value, size);
      if (options.align === 'center') tx = x - textWidth(value, size) / 2;
      add(`BT /${font} ${size} Tf ${rgb(color)} rg ${tx.toFixed(2)} ${baseline.toFixed(2)} Td (${this.escapePdfText(value)}) Tj ET`);
    };
    const line = (x1: number, y1: number, x2: number, y2: number, color: [number, number, number] = [226, 232, 240]) => {
      add(`q ${rgb(color)} RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S Q`);
    };
    const newPage = () => {
      pages.push([]);
      y = pageHeight - margin;
    };
    const ensureSpace = (height: number) => {
      if (y - height < 58) newPage();
    };
    const sectionTitle = (title: string) => {
      ensureSpace(38);
      y -= 12;
      rect(margin, y + 8, 4, 18, [31, 122, 140]);
      text(title, margin + 12, y - 5, { size: 13, font: 'bold', color: [15, 23, 42] });
      line(margin, y - 14, pageWidth - margin, y - 14);
      y -= 30;
    };
    const emptyMessage = (message: string) => {
      ensureSpace(28);
      rect(margin, y, pageWidth - margin * 2, 24, [248, 250, 252]);
      text(message, margin + 10, y - 16, { color: [100, 116, 139] });
      y -= 34;
    };
    const table = (headers: string[], values: string[][], widths: number[], aligns: Array<'left' | 'right'> = []) => {
      const rowHeight = 22;
      const tableWidth = widths.reduce((sum, width) => sum + width, 0);
      ensureSpace(rowHeight * 2);
      rect(margin, y, tableWidth, rowHeight, [31, 122, 140]);
      let x = margin;
      headers.forEach((header, index) => {
        text(header, x + 7, y - 15, { size: 8.5, font: 'bold', color: [255, 255, 255] });
        x += widths[index];
      });
      y -= rowHeight;

      for (const [rowIndex, row] of values.entries()) {
        ensureSpace(rowHeight + 4);
        if (rowIndex % 2 === 0) rect(margin, y, tableWidth, rowHeight, [248, 250, 252]);
        x = margin;
        row.forEach((value, index) => {
          const clipped = this.truncatePdfText(value, Math.max(8, Math.floor(widths[index] / 5.2)));
          const align = aligns[index] || 'left';
          const tx = align === 'right' ? x + widths[index] - 7 : x + 7;
          text(clipped, tx, y - 15, { size: 8.5, align, color: [51, 65, 85] });
          x += widths[index];
        });
        line(margin, y - rowHeight, margin + tableWidth, y - rowHeight, [232, 238, 245]);
        y -= rowHeight;
      }
      y -= 12;
    };

    rect(0, pageHeight, pageWidth, 92, [15, 48, 63]);
    rect(0, pageHeight - 92, pageWidth, 5, [31, 122, 140]);
    text('Controle Transporte', margin, pageHeight - 43, { size: 11, font: 'bold', color: [148, 213, 220] });
    text('Relatório financeiro, comissões e consumo', margin, pageHeight - 67, { size: 17, font: 'bold', color: [255, 255, 255] });
    text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin, pageHeight - 47, { size: 9, align: 'right', color: [203, 213, 225] });
    text(`${relatorio.total} lançamentos`, pageWidth - margin, pageHeight - 68, { size: 10, font: 'bold', align: 'right', color: [255, 255, 255] });
    y = pageHeight - 120;

    const cards = [
      { label: 'Despesas', value: this.formatCurrency(relatorio.totalDespesas), color: [180, 35, 24] as [number, number, number] },
      { label: 'Faturamento', value: this.formatCurrency(relatorio.totalFaturamento), color: [22, 128, 60] as [number, number, number] },
      { label: 'Saldo final', value: this.formatCurrency(relatorio.saldoFinal), color: relatorio.saldoFinal >= 0 ? [31, 122, 140] as [number, number, number] : [180, 35, 24] as [number, number, number] },
    ];
    const cardGap = 12;
    const cardWidth = (pageWidth - margin * 2 - cardGap * 2) / 3;
    cards.forEach((card, index) => {
      const x = margin + index * (cardWidth + cardGap);
      rect(x, y, cardWidth, 70, [248, 250, 252]);
      rect(x, y, cardWidth, 5, card.color);
      text(card.label, x + 14, y - 25, { size: 9, font: 'bold', color: [100, 116, 139] });
      text(card.value, x + 14, y - 51, { size: 15, font: 'bold', color: [15, 23, 42] });
    });
    y -= 94;

    sectionTitle('Lançamentos encontrados');
    if (rows.length) {
      table(
        ['Data', 'Tipo', 'Placa', 'Motorista', 'Categoria', 'Valor total'],
        rows.map((item) => [
          this.formatDate(item.data),
          item.tipoLancamento === TipoLancamento.DESPESA ? 'Despesa' : 'Faturamento',
          item.cavaloMecanico?.placa || item.placa || '-',
          item.motorista?.nome || '-',
          item.categoriaFinanceira?.nome || '-',
          this.formatCurrency(item.valorTotal),
        ]),
        [58, 78, 62, 116, 104, 105],
        ['left', 'left', 'left', 'left', 'left', 'right'],
      );
    } else {
      emptyMessage('Nenhum lançamento encontrado para os filtros informados.');
    }

    sectionTitle('Resumo por grupo');
    table(['Despesas por cavalo mecânico', 'Total'], this.pdfGroupRows(relatorio.despesasPorCavaloMecanico), [390, 133], ['left', 'right']);
    table(['Despesas por motorista', 'Total'], this.pdfGroupRows(relatorio.despesasPorMotorista), [390, 133], ['left', 'right']);
    table(['Faturamento por cavalo mecânico', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorCavaloMecanico), [390, 133], ['left', 'right']);
    table(['Faturamento por motorista', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorMotorista), [390, 133], ['left', 'right']);

    sectionTitle('Resumo por composição do cavalo');
    if (relatorio.conjuntosPorCavalo.length) {
      table(
        ['Cavalo', 'Conjunto', 'Tipo', 'Lanc.', 'Despesas', 'Faturamento', 'Saldo'],
        relatorio.conjuntosPorCavalo.map((item: any) => [
          item.cavalo || '-',
          item.conjunto || '-',
          item.tipoConjunto || '-',
          String(item.quantidadeLancamentos),
          this.formatCurrency(item.totalDespesas),
          this.formatCurrency(item.totalFaturamento),
          this.formatCurrency(item.saldo),
        ]),
        [90, 96, 56, 42, 78, 88, 73],
        ['left', 'left', 'left', 'right', 'right', 'right', 'right'],
      );
    } else {
      emptyMessage('Nenhum conjunto encontrado para os filtros informados.');
    }

    sectionTitle('Comissões dos faturamentos');
    if (relatorio.comissoes.resumo.quantidade) {
      const resumo = relatorio.comissoes.resumo;
      table(
        ['Viagens', 'Faturamento relacionado', 'Total de comissões', 'Após comissões'],
        [[
          String(resumo.quantidade),
          this.formatCurrency(resumo.totalFaturado),
          this.formatCurrency(resumo.totalComissoes),
          this.formatCurrency(resumo.faturamentoAposComissoes),
        ]],
        [62, 154, 145, 162],
        ['right', 'right', 'right', 'right'],
      );
      table(
        ['Data', 'Cavalo', 'Motorista', 'Eixos', 'Tipo', 'Regra', 'Faturamento', 'Comissão'],
        relatorio.comissoes.historico.map((item: any) => [
          this.formatDate(item.data),
          item.cavaloMecanico?.placa || item.placa || '-',
          item.motorista?.nome || '-',
          String(item.quantidadeEixosComissao),
          this.commissionTypeLabel(item.tipoComissao),
          this.commissionRuleLabel(item),
          this.formatCurrency(item.valorTotal),
          this.formatCurrency(item.valorComissao),
        ]),
        [52, 59, 90, 38, 68, 72, 75, 69],
        ['left', 'left', 'left', 'right', 'left', 'right', 'right', 'right'],
      );
    } else {
      emptyMessage('Nenhuma comissão encontrada para os filtros informados.');
    }

    sectionTitle('Consumo dos cavalos');
    if (relatorio.consumo.resumo.quantidadeRegistros) {
      table(
        ['Cavalo', 'Abast.', 'Distância', 'Litros', 'Média km/l'],
        relatorio.consumo.porCavalo.map((item: any) => [
          item.cavalo || '-',
          String(item.quantidadeRegistros),
          `${this.formatDecimal(item.distanciaTotal, 1)} km`,
          `${this.formatDecimal(item.litrosTotal, 3)} L`,
          this.formatDecimal(item.mediaGeralKmLitro, 3),
        ]),
        [188, 54, 96, 96, 89],
        ['left', 'right', 'right', 'right', 'right'],
      );

      sectionTitle('Histórico de abastecimentos');
      table(
        ['Data', 'Cavalo', 'Km anterior', 'Km atual', 'Distância', 'Litros', 'Média'],
        relatorio.consumo.historico.map((item: any) => [
          this.formatDate(item.data),
          item.cavaloMecanico?.placa || '-',
          this.formatDecimal(item.kmAnterior, 1),
          this.formatDecimal(item.kmAtual, 1),
          this.formatDecimal(item.distanciaPercorrida, 1),
          this.formatDecimal(item.litros, 3),
          `${this.formatDecimal(item.mediaKmLitro, 3)} km/l`,
        ]),
        [55, 72, 76, 70, 76, 70, 104],
        ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
      );
    } else {
      emptyMessage('Nenhum abastecimento encontrado para os filtros informados.');
    }

    pages.forEach((page, index) => {
      page.push(`BT /F1 8 Tf ${rgb([100, 116, 139])} rg ${margin} 28 Td (${this.escapePdfText('Controle Transporte')}) Tj ET`);
      page.push(`BT /F1 8 Tf ${rgb([100, 116, 139])} rg ${pageWidth - margin - 58} 28 Td (${this.escapePdfText(`Página ${index + 1} de ${pages.length}`)}) Tj ET`);
    });

    return this.renderPdf(pages);
  }

  private renderPdf(pages: string[][]) {
    const fontRegularObjectId = 3 + pages.length * 2;
    const fontBoldObjectId = fontRegularObjectId + 1;
    const pageObjectIds = pages.map((_, index) => 3 + index * 2);
    const contentObjectIds = pages.map((_, index) => 4 + index * 2);
    const objects = [
      `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
      `2 0 obj << /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >> endobj`,
      ...pages.flatMap((pageCommands, index) => {
        const content = pageCommands.join('\n');
        return [
          `${pageObjectIds[index]} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularObjectId} 0 R /F2 ${fontBoldObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >> endobj`,
          `${contentObjectIds[index]} 0 obj << /Length ${Buffer.byteLength(content, 'latin1')} >> stream\n${content}\nendstream endobj`,
        ];
      }),
      `${fontRegularObjectId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj`,
      `${fontBoldObjectId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj`,
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

  private escapePdfText(line: string) {
    return this.normalizePdfText(line).replace(/[()\\]/g, '\\$&');
  }

  private normalizePdfText(line: string) {
    return String(line).replace(/[^\x20-\x7E\xA0-\xFF]/g, '-');
  }

  private truncatePdfText(value: string, maxLength: number) {
    const normalized = this.normalizePdfText(value || '-');
    return normalized.length > maxLength ? `${normalized.slice(0, Math.max(0, maxLength - 3))}...` : normalized;
  }

  private pdfGroupRows(rows: Array<{ label: string; total: number }>) {
    return rows.length ? rows.map((row) => [row.label || 'Sem cadastro', this.formatCurrency(row.total)]) : [['Nenhum registro encontrado.', '-']];
  }

  private formatCurrency(value: unknown) {
    return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private formatDecimal(value: unknown, digits: number) {
    return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
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

  private async comissoes(filters: RelatorioFinanceiroQueryDto, take = 50) {
    const commissionFilters = {
      ...filters,
      tipoLancamento: undefined,
      categoriaId: undefined,
      quantidadeEixos: undefined,
    };
    const baseWhere: any = await this.buildWhere(commissionFilters);
    const and = [...(baseWhere.AND || [])];
    if (filters.categoriaId) {
      and.push({
        OR: [
          { categoriaId: filters.categoriaId },
          { despesaComissao: { is: { categoriaId: filters.categoriaId } } },
        ],
      });
    }
    if (filters.quantidadeEixos !== undefined) {
      and.push({ quantidadeEixosComissao: filters.quantidadeEixos });
    }
    and.push(
      { tipoLancamento: TipoLancamento.FATURAMENTO },
      { tipoComissao: { not: null } },
      { valorComissao: { not: null } },
      { despesaComissao: { isNot: null } },
    );
    const where = { AND: and };
    const [totais, historico] = await Promise.all([
      this.prisma.lancamentoFinanceiro.aggregate({
        where,
        _count: { _all: true },
        _sum: { valorTotal: true, valorComissao: true },
      }),
      this.prisma.lancamentoFinanceiro.findMany({
        where,
        include: this.lancamentoInclude(),
        orderBy: { [filters.orderBy || 'data']: filters.orderDirection || 'desc' },
        take,
      }),
    ]);
    const totalFaturado = Number(totais._sum.valorTotal || 0);
    const totalComissoes = Number(totais._sum.valorComissao || 0);

    return {
      resumo: {
        quantidade: totais._count._all,
        totalFaturado,
        totalComissoes,
        faturamentoAposComissoes: Number((totalFaturado - totalComissoes).toFixed(2)),
      },
      historico,
    };
  }

  private commissionTypeLabel(tipo: unknown) {
    if (tipo === 'PERCENTUAL') return 'Percentual';
    if (tipo === 'POR_VIAGEM') return 'Por viagem';
    return '';
  }

  private commissionRuleLabel(item: any) {
    return item?.tipoComissao === 'PERCENTUAL'
      ? `${this.formatDecimal(item.percentualComissao, 2)}%`
      : this.formatCurrency(item?.valorComissaoPorViagem);
  }

  private async consumo(filters: RelatorioFinanceiroQueryDto, take = 50) {
    const where = this.buildAbastecimentoWhere(filters);
    const [totais, grupos, historico] = await Promise.all([
      this.prisma.abastecimento.aggregate({
        where,
        _count: { _all: true },
        _sum: { distanciaPercorrida: true, litros: true },
      }),
      this.prisma.abastecimento.groupBy({
        by: ['cavaloMecanicoId'],
        where,
        _count: { _all: true },
        _sum: { distanciaPercorrida: true, litros: true },
      }),
      this.prisma.abastecimento.findMany({
        where,
        include: { cavaloMecanico: true },
        orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
        take,
      }),
    ]);
    const ids = grupos.map((item) => item.cavaloMecanicoId);
    const cavalos = await this.prisma.cavaloMecanico.findMany({
      where: { id: { in: ids } },
      select: { id: true, placa: true, marca: true, modelo: true },
    });
    const labels = new Map(cavalos.map((item) => [item.id, [item.placa, item.marca, item.modelo].filter(Boolean).join(' - ')]));
    const distanciaTotal = Number(totais._sum.distanciaPercorrida || 0);
    const litrosTotal = Number(totais._sum.litros || 0);

    return {
      resumo: {
        quantidadeRegistros: totais._count._all,
        distanciaTotal,
        litrosTotal,
        mediaGeralKmLitro: litrosTotal > 0 ? distanciaTotal / litrosTotal : 0,
      },
      porCavalo: grupos.map((item) => {
        const distancia = Number(item._sum.distanciaPercorrida || 0);
        const litros = Number(item._sum.litros || 0);
        return {
          cavaloMecanicoId: item.cavaloMecanicoId,
          cavalo: labels.get(item.cavaloMecanicoId) || 'Sem cadastro',
          quantidadeRegistros: item._count._all,
          distanciaTotal: distancia,
          litrosTotal: litros,
          mediaGeralKmLitro: litros > 0 ? distancia / litros : 0,
        };
      }),
      historico,
    };
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






