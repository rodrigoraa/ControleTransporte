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

type FinancialGroupField = 'placa' | 'cavaloMecanicoId' | 'motoristaId' | 'clienteId' | 'fornecedorId' | 'categoriaId' | 'implementoId' | 'conjuntoId';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async opcoes(filters: RelatorioFinanceiroQueryDto = {}) {
    if (filters.tipoRelatorio !== 'RELATORIO_COMBINADO' && filters.tipoRelatorio !== 'MEDIA_FROTA') {
      return this.opcoesRegistroGeral();
    }
    if (filters.tipoRelatorio === 'MEDIA_FROTA') {
      const where = this.buildAbastecimentoWhere(this.withoutFilters(filters, 'cavaloMecanicoId', 'cavaloMecanicoIds'));
      const rows = await this.prisma.abastecimento.findMany({
        where,
        distinct: ['cavaloMecanicoId'],
        select: { cavaloMecanico: { select: { id: true, placa: true, marca: true, modelo: true } } },
        orderBy: { cavaloMecanico: { placa: 'asc' } },
      });
      return {
        ...this.emptyOptions(),
        cavalosMecanicos: this.uniqueOptions(rows.map((row) => ({
          value: row.cavaloMecanico.id,
          label: [row.cavaloMecanico.placa, row.cavaloMecanico.marca, row.cavaloMecanico.modelo].filter(Boolean).join(' - '),
        }))),
      };
    }

    const facets = await Promise.all([
      this.optionRows(filters, ['motoristaId', 'motoristaIds']),
      this.optionRows(filters, ['cavaloMecanicoId', 'cavaloMecanicoIds']),
      this.optionRows(filters, ['implementoId', 'implementoIds']),
      this.optionRows(filters, ['conjuntoId', 'conjuntoIds']),
      this.optionRows(filters, ['fornecedorId', 'fornecedorIds']),
      this.optionRows(filters, ['clienteId', 'clienteIds']),
      this.optionRows(filters, ['categoriaId', 'categoriaIds']),
      this.optionRows(filters, ['tipoLancamento', 'tiposLancamento']),
      this.optionRows(filters, ['tipoConjunto', 'tiposConjunto']),
      this.optionRows(filters, ['quantidadeEixos', 'quantidadesEixos']),
    ]);
    const [motoristaRows, cavaloRows, implementoRows, conjuntoRows, fornecedorRows, clienteRows, categoriaRows, tipoRows, tipoConjuntoRows, eixoRows] = facets;
    const implementos = implementoRows.flatMap((row) => [
      row.implemento,
      ...(row.conjunto?.implementos || []).map((vinculo) => vinculo.implemento),
    ]).filter((item): item is NonNullable<typeof item> => item != null);

    return {
      motoristas: this.uniqueOptions(motoristaRows.filter((row) => row.motorista).map((row) => ({ value: row.motorista!.id, label: [row.motorista!.nome, row.motorista!.cpf].filter(Boolean).join(' - ') }))),
      cavalosMecanicos: this.uniqueOptions(cavaloRows.filter((row) => row.cavaloMecanico).map((row) => ({ value: row.cavaloMecanico!.id, label: [row.cavaloMecanico!.placa, row.cavaloMecanico!.marca, row.cavaloMecanico!.modelo].filter(Boolean).join(' - ') }))),
      implementos: this.uniqueOptions(implementos.map((item) => ({ value: item.id, label: [item.placa, item.tipo, item.carroceria, `${item.quantidadeEixos} eixos`].filter(Boolean).join(' - ') }))),
      conjuntos: this.uniqueOptions(conjuntoRows.filter((row) => row.conjunto).map((row) => ({ value: row.conjunto!.id, label: [row.conjunto!.nome, row.conjunto!.tipo, `${row.conjunto!.quantidadeTotalEixos} eixos`].filter(Boolean).join(' - ') }))),
      fornecedores: this.uniqueOptions(fornecedorRows.filter((row) => row.fornecedor).map((row) => ({ value: row.fornecedor!.id, label: [row.fornecedor!.nome, row.fornecedor!.documento].filter(Boolean).join(' - ') }))),
      clientes: this.uniqueOptions(clienteRows.filter((row) => row.cliente).map((row) => ({ value: row.cliente!.id, label: [row.cliente!.nome, row.cliente!.documento].filter(Boolean).join(' - ') }))),
      categorias: this.uniqueOptions(categoriaRows.filter((row) => row.categoriaFinanceira).map((row) => ({ value: row.categoriaFinanceira!.id, label: [row.categoriaFinanceira!.nome, row.categoriaFinanceira!.tipoLancamento].filter(Boolean).join(' - ') }))),
      tipos: this.uniqueOptions(tipoRows.map((row) => ({ value: row.tipoLancamento, label: row.tipoLancamento === TipoLancamento.DESPESA ? 'Despesa' : 'Faturamento' }))),
      tiposConjunto: this.uniqueOptions(tipoConjuntoRows.filter((row) => row.conjunto).map((row) => ({ value: row.conjunto!.tipo, label: this.tipoConjuntoLabel(row.conjunto!.tipo) }))),
      quantidadesEixos: this.uniqueOptions(eixoRows.filter((row) => row.conjunto).map((row) => ({ value: String(row.conjunto!.quantidadeTotalEixos), label: `${row.conjunto!.quantidadeTotalEixos} eixos` }))),
    };
  }

  private async opcoesRegistroGeral() {
    const [motoristas, cavalos, implementos, conjuntos, fornecedores, clientes, categorias, tipos] = await Promise.all([
      this.prisma.motorista.findMany({ select: { id: true, nome: true, cpf: true }, orderBy: { nome: 'asc' } }),
      this.prisma.cavaloMecanico.findMany({ select: { id: true, placa: true, modelo: true, marca: true }, orderBy: { placa: 'asc' } }),
      this.prisma.implemento.findMany({ select: { id: true, placa: true, tipo: true, carroceria: true, quantidadeEixos: true }, orderBy: { placa: 'asc' } }),
      this.prisma.conjunto.findMany({ select: { id: true, nome: true, tipo: true, quantidadeTotalEixos: true }, orderBy: { nome: 'asc' } }),
      this.prisma.fornecedor.findMany({ select: { id: true, nome: true, documento: true }, orderBy: { nome: 'asc' } }),
      this.prisma.cliente.findMany({ select: { id: true, nome: true, documento: true }, orderBy: { nome: 'asc' } }),
      this.prisma.categoriaFinanceira.findMany({ where: { ativo: true }, select: { id: true, nome: true, tipoLancamento: true }, orderBy: { nome: 'asc' } }),
      this.prisma.lancamentoFinanceiro.findMany({ distinct: ['tipoLancamento'], select: { tipoLancamento: true }, orderBy: { tipoLancamento: 'asc' } }),
    ]);

    return {
      motoristas: motoristas.map((item) => ({ value: item.id, label: [item.nome, item.cpf].filter(Boolean).join(' - ') })),
      cavalosMecanicos: cavalos.map((item) => ({ value: item.id, label: [item.placa, item.marca, item.modelo].filter(Boolean).join(' - ') })),
      implementos: implementos.map((item) => ({ value: item.id, label: [item.placa, item.tipo, item.carroceria, `${item.quantidadeEixos} eixos`].filter(Boolean).join(' - ') })),
      conjuntos: conjuntos.map((item) => ({ value: item.id, label: [item.nome, item.tipo, `${item.quantidadeTotalEixos} eixos`].filter(Boolean).join(' - ') })),
      fornecedores: fornecedores.map((item) => ({ value: item.id, label: [item.nome, item.documento].filter(Boolean).join(' - ') })),
      clientes: clientes.map((item) => ({ value: item.id, label: [item.nome, item.documento].filter(Boolean).join(' - ') })),
      categorias: categorias.map((item) => ({ value: item.id, label: [item.nome, item.tipoLancamento].filter(Boolean).join(' - ') })),
      tipos: tipos.map((item) => ({ value: item.tipoLancamento, label: item.tipoLancamento === TipoLancamento.DESPESA ? 'Despesa' : 'Faturamento' })),
      tiposConjunto: this.uniqueOptions(conjuntos.map((item) => ({ value: item.tipo, label: this.tipoConjuntoLabel(item.tipo) }))),
      quantidadesEixos: this.uniqueOptions(conjuntos.map((item) => ({ value: String(item.quantidadeTotalEixos), label: `${item.quantidadeTotalEixos} eixos` }))),
    };
  }

  private emptyOptions() {
    return { motoristas: [], cavalosMecanicos: [], implementos: [], conjuntos: [], fornecedores: [], clientes: [], categorias: [], tipos: [], tiposConjunto: [], quantidadesEixos: [] };
  }

  private uniqueOptions<T extends { value: string; label: string }>(options: T[]) {
    return [...new Map(options.map((option) => [option.value, option])).values()]
      .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
  }

  private tipoConjuntoLabel(tipo: string) {
    return ({ SIMPLES: 'Simples', BITREM: 'Bitrem', RODOTREM: 'Rodotrem', OUTRO: 'Outro' } as Record<string, string>)[tipo] || tipo;
  }

  private withoutFilters(filters: RelatorioFinanceiroQueryDto, ...keys: Array<keyof RelatorioFinanceiroQueryDto>) {
    const result = { ...filters } as Record<string, unknown>;
    keys.forEach((key) => delete result[key]);
    return result as RelatorioFinanceiroQueryDto;
  }

  private async optionRows(filters: RelatorioFinanceiroQueryDto, omittedKeys: Array<keyof RelatorioFinanceiroQueryDto>) {
    const where = await this.buildWhere(this.withoutFilters(filters, ...omittedKeys));
    return this.prisma.lancamentoFinanceiro.findMany({
      where,
      select: {
        tipoLancamento: true,
        motorista: { select: { id: true, nome: true, cpf: true } },
        cavaloMecanico: { select: { id: true, placa: true, marca: true, modelo: true } },
        implemento: { select: { id: true, placa: true, tipo: true, carroceria: true, quantidadeEixos: true } },
        conjunto: {
          select: {
            id: true,
            nome: true,
            tipo: true,
            quantidadeTotalEixos: true,
            implementos: { select: { implemento: { select: { id: true, placa: true, tipo: true, carroceria: true, quantidadeEixos: true } } } },
          },
        },
        fornecedor: { select: { id: true, nome: true, documento: true } },
        cliente: { select: { id: true, nome: true, documento: true } },
        categoriaFinanceira: { select: { id: true, nome: true, tipoLancamento: true } },
      },
    });
  }

  private filterValues(value?: string | number | null) {
    if (value === undefined || value === null || value === '') return [];
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }

  private async buildWhere(filters: RelatorioFinanceiroQueryDto) {
    const and: any[] = [];
    if (filters.dataInicial || filters.dataFinal) {
      const data: any = {};
      if (filters.dataInicial) data.gte = new Date(`${filters.dataInicial}T00:00:00.000Z`);
      if (filters.dataFinal) data.lte = new Date(`${filters.dataFinal}T23:59:59.999Z`);
      and.push({ data });
    }
    for (const [field, pluralField] of [
      ['motoristaId', 'motoristaIds'],
      ['cavaloMecanicoId', 'cavaloMecanicoIds'],
      ['conjuntoId', 'conjuntoIds'],
      ['fornecedorId', 'fornecedorIds'],
      ['clienteId', 'clienteIds'],
      ['categoriaId', 'categoriaIds'],
    ] as const) {
      const values = this.filterValues(filters[pluralField] || filters[field]);
      if (values.length) and.push({ [field]: { in: values } });
    }
    const implementoIds = this.filterValues(filters.implementoIds || filters.implementoId);
    if (implementoIds.length) {
      const vinculos = await this.prisma.conjuntoImplemento.findMany({
        where: { implementoId: { in: implementoIds } },
        select: { conjuntoId: true },
      });
      const conjuntoIds = vinculos.map((item) => item.conjuntoId);
      and.push({
        OR: [
          { implementoId: { in: implementoIds } },
          ...(conjuntoIds.length ? [{ conjuntoId: { in: conjuntoIds } }] : []),
        ],
      });
    }
    const conjunto: any = {};
    const tiposConjunto = this.filterValues(filters.tiposConjunto || filters.tipoConjunto);
    const quantidadesEixos = this.filterValues(filters.quantidadesEixos || filters.quantidadeEixos).map(Number).filter(Number.isFinite);
    if (tiposConjunto.length) conjunto.tipo = { in: tiposConjunto };
    if (quantidadesEixos.length) conjunto.quantidadeTotalEixos = { in: quantidadesEixos };
    if (Object.keys(conjunto).length) and.push({ conjunto });
    const tiposLancamento = this.filterValues(filters.tiposLancamento || filters.tipoLancamento);
    if (tiposLancamento.length) and.push({ tipoLancamento: { in: tiposLancamento } });
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
    const cavaloIds = this.filterValues(filters.cavaloMecanicoIds || filters.cavaloMecanicoId);
    if (cavaloIds.length) where.cavaloMecanicoId = { in: cavaloIds };
    if (filters.placa) where.cavaloMecanico = { placa: { contains: filters.placa, mode: 'insensitive' } };
    return where;
  }

  private periodoAnteriorConsumo(filters: RelatorioFinanceiroQueryDto) {
    if (!filters.dataInicial || !filters.dataFinal) return null;
    const inicioAtual = new Date(`${filters.dataInicial}T00:00:00.000Z`);
    const fimAtual = new Date(`${filters.dataFinal}T23:59:59.999Z`);
    if (fimAtual < inicioAtual) return null;

    const duracao = fimAtual.getTime() - inicioAtual.getTime() + 1;
    const fimAnterior = new Date(inicioAtual.getTime() - 1);
    const inicioAnterior = new Date(fimAnterior.getTime() - duracao + 1);
    return {
      inicio: inicioAnterior,
      fim: fimAnterior,
      dataInicial: inicioAnterior.toISOString().slice(0, 10),
      dataFinal: fimAnterior.toISOString().slice(0, 10),
    };
  }

  async financeiros(filters: RelatorioFinanceiroQueryDto): Promise<any> {
    if (filters.tipoRelatorio === 'MEDIA_FROTA') {
      return {
        tipoRelatorio: 'MEDIA_FROTA',
        consumo: await this.consumo(filters),
      };
    }

    const where = await this.buildWhere(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const orderBy = this.lancamentoOrderBy(filters);
    const [
      despesas,
      faturamento,
      total,
      historico,
      despesasPorCavaloMecanico,
      despesasPorMotorista,
      despesasPorCliente,
      despesasPorFornecedor,
      despesasPorCategoria,
      faturamentoPorCavaloMecanico,
      faturamentoPorMotorista,
      faturamentoPorCliente,
      faturamentoPorFornecedor,
      faturamentoPorCategoria,
      despesasOperacionais,
      faturamentoOperacionais,
      conjuntosPorCavalo,
      comissoes,
    ] =
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
        this.groupWithLabels('clienteId', { ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.groupWithLabels('fornecedorId', { ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.groupWithLabels('categoriaId', { ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.groupWithLabels('cavaloMecanicoId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.groupWithLabels('motoristaId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.groupWithLabels('clienteId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.groupWithLabels('fornecedorId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.groupWithLabels('categoriaId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.operationalDimensionGroups({ ...where, tipoLancamento: TipoLancamento.DESPESA }),
        this.operationalDimensionGroups({ ...where, tipoLancamento: TipoLancamento.FATURAMENTO }),
        this.conjuntosPorCavalo(where),
        this.comissoes(filters),
      ]);

    return {
      totalDespesas: despesas,
      totalFaturamento: faturamento,
      saldoFinal: faturamento - despesas,
      despesasPorCavaloMecanico,
      despesasPorMotorista,
      despesasPorCliente,
      despesasPorFornecedor,
      despesasPorCategoria,
      faturamentoPorCavaloMecanico,
      faturamentoPorMotorista,
      faturamentoPorCliente,
      faturamentoPorFornecedor,
      faturamentoPorCategoria,
      despesasPorPlaca: despesasOperacionais.porPlaca,
      faturamentoPorPlaca: faturamentoOperacionais.porPlaca,
      despesasPorImplemento: despesasOperacionais.porImplemento,
      faturamentoPorImplemento: faturamentoOperacionais.porImplemento,
      despesasPorConjunto: despesasOperacionais.porConjunto,
      faturamentoPorConjunto: faturamentoOperacionais.porConjunto,
      despesasPorTipoConjunto: despesasOperacionais.porTipoConjunto,
      faturamentoPorTipoConjunto: faturamentoOperacionais.porTipoConjunto,
      despesasPorQuantidadeEixos: despesasOperacionais.porQuantidadeEixos,
      faturamentoPorQuantidadeEixos: faturamentoOperacionais.porQuantidadeEixos,
      conjuntosPorCavalo,
      comissoes,
      historico,
      total,
      page,
      limit,
    };
  }

  async exportarCsv(filters: RelatorioFinanceiroQueryDto) {
    if (filters.tipoRelatorio === 'MEDIA_FROTA') {
      const consumo = await this.consumo(filters, 5000);
      return this.csvText(this.consumoCsvRows(consumo));
    }

    const [rows, comissoes] = await Promise.all([
      this.exportRows(filters),
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
      'Comissão bruta',
      'Desconto de impostos',
      'Valor do desconto de impostos',
      'Comissão líquida',
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
        this.formatCsvDecimal(item.valorUnitario, 2),
        this.formatCsvDecimal(item.valorTotal, 2),
        this.commissionTypeLabel(faturamentoComissao?.tipoComissao),
        faturamentoComissao?.quantidadeEixosComissao ?? '',
        faturamentoComissao?.percentualComissao != null ? this.formatCsvDecimal(faturamentoComissao.percentualComissao, 2) : '',
        faturamentoComissao?.valorComissaoPorViagem != null ? this.formatCsvDecimal(faturamentoComissao.valorComissaoPorViagem, 2) : '',
        faturamentoComissao?.valorComissaoBruta != null ? this.formatCsvDecimal(faturamentoComissao.valorComissaoBruta, 2) : '',
        faturamentoComissao ? (faturamentoComissao.descontoImpostos ? 'Sim' : 'Não') : '',
        faturamentoComissao?.valorDescontoImpostos != null ? this.formatCsvDecimal(faturamentoComissao.valorDescontoImpostos, 2) : '',
        faturamentoComissao?.valorComissao != null ? this.formatCsvDecimal(faturamentoComissao.valorComissao, 2) : '',
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
      this.formatCsvDecimal(item.valorTotal, 2),
      this.formatCsvDecimal(item.valorComissaoBruta ?? item.valorComissao, 2),
      this.formatCsvDecimal(item.valorDescontoImpostos || 0, 2),
      this.formatCsvDecimal(item.valorComissao, 2),
      (Number(item.valorTotal) - Number(item.valorComissao)).toFixed(2),
    ]);
    const csvRows = [
      header,
      ...body,
      [],
      ['Resumo de comissões dos faturamentos'],
      ['Viagens com comissão', 'Faturamento relacionado', 'Total de comissões', 'Faturamento após comissões'],
      [
        String(resumoComissoes.quantidade),
        this.formatCsvDecimal(resumoComissoes.totalFaturado, 2),
        this.formatCsvDecimal(resumoComissoes.totalComissoes, 2),
        this.formatCsvDecimal(resumoComissoes.faturamentoAposComissoes, 2),
      ],
      [],
      ['Histórico de comissões'],
      ['Data', 'Cavalo mecânico', 'Motorista', 'Eixos', 'Tipo', 'Regra', 'Faturamento', 'Comissão bruta', 'Impostos', 'Comissão líquida', 'Após comissão'],
      ...comissoesBody,
    ];
    return this.csvText(csvRows);
  }

  private consumoCsvRows(consumo: any) {
    const consumoHeader = ['Data', 'Cavalo mecânico', 'Km anterior', 'Km atual', 'Distância percorrida', 'Litros', 'Média km/l', 'Divergência', 'Observações'];
    const consumoBody = consumo.historico.map((item: any) => [
      item.data.toISOString().slice(0, 10),
      [item.cavaloMecanico?.placa, item.cavaloMecanico?.marca, item.cavaloMecanico?.modelo].filter(Boolean).join(' - '),
      this.formatCsvDecimal(item.kmAnterior, 1),
      this.formatCsvDecimal(item.kmAtual, 1),
      this.formatCsvDecimal(item.distanciaPercorrida, 1),
      this.formatCsvDecimal(item.litros, 2),
      this.formatCsvDecimal(item.mediaKmLitro, 2),
      item.divergente ? 'Sim' : 'Não',
      item.observacoes || '',
    ]);
    const resumoConsumo = consumo.porCavalo.map((item: any) => [
      item.posicao == null ? '' : String(item.posicao),
      item.placa,
      item.cavalo,
      String(item.quantidadeRegistros),
      this.formatCsvDecimal(item.distanciaTotal, 1),
      this.formatCsvDecimal(item.litrosTotal, 2),
      this.formatCsvDecimal(item.mediaGeralKmLitro, 2),
      item.mediaPeriodoAnterior == null ? '' : this.formatCsvDecimal(item.mediaPeriodoAnterior, 2),
      item.variacaoPercentual == null ? '' : this.formatCsvDecimal(item.variacaoPercentual, 2),
      String(item.quantidadeDivergencias),
      item.amostraConfiavel ? 'Confiável' : 'Amostra pequena',
    ]);
    return [
      ['Média da frota'],
      consumo.periodoComparacao
        ? ['Período anterior comparado', consumo.periodoComparacao.dataInicial, consumo.periodoComparacao.dataFinal]
        : ['Período anterior comparado', 'Não disponível: informe data inicial e final'],
      ['Posição', 'Placa', 'Cavalo mecânico', 'Abastecimentos', 'Distância total', 'Litros registrados', 'Média atual km/l', 'Média anterior km/l', 'Variação %', 'Divergências', 'Amostra'],
      ...resumoConsumo,
      [],
      ['Histórico de abastecimentos'],
      consumoHeader,
      ...consumoBody,
    ];
  }

  private csvText(rows: any[][]) {
    return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
  }

  private formatCsvDecimal(value: unknown, digits: number) {
    return Number(value || 0).toFixed(digits);
  }

  async exportarPdf(filters: RelatorioFinanceiroQueryDto) {
    if (filters.tipoRelatorio === 'MEDIA_FROTA') {
      const consumo = await this.consumo(filters, 5000);
      return this.styledFinancialPdf(
        { tipoRelatorio: 'MEDIA_FROTA', consumo, total: consumo.resumo.quantidadeRegistros },
        [],
        true,
        filters,
      );
    }

    const [relatorio, rows, comissoes] = await Promise.all([
      this.financeiros({ ...filters, page: 1, limit: 50 }),
      this.exportRows(filters),
      this.comissoes(filters, 5000),
    ]);
    relatorio.comissoes = comissoes;
    return this.styledFinancialPdf(relatorio, rows, false, filters);
  }

  private async exportRows(filters: RelatorioFinanceiroQueryDto) {
    return this.prisma.lancamentoFinanceiro.findMany({
      where: await this.buildWhere(filters),
      include: this.lancamentoInclude(),
      orderBy: this.lancamentoOrderBy(filters),
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

  private styledFinancialPdf(
    relatorio: any,
    rows: any[],
    somenteConsumo = false,
    filters: RelatorioFinanceiroQueryDto = {},
  ) {
    const defaultSections = somenteConsumo
      ? ['resumo_frota', 'ranking_frota', 'comparacao_periodo', 'historico_abastecimentos']
      : ['resumo_financeiro', 'lancamentos', 'grupos_cavalo', 'grupos_placas', 'grupos_motorista', 'grupos_clientes', 'grupos_fornecedores', 'grupos_categorias', 'grupos_implementos', 'grupos_conjuntos', 'grupos_tipos_conjunto', 'grupos_eixos', 'grupos_tipos_financeiros', 'composicoes', 'comissoes'];
    const selectedSections = new Set(
      filters.secoesPdf === undefined
        ? defaultSections
        : filters.secoesPdf.split(',').map((item) => item.trim()).filter(Boolean),
    );
    const selectedColumns = filters.colunasPdf === undefined
      ? null
      : new Set(filters.colunasPdf.split(',').map((item) => item.trim()).filter(Boolean));
    const columnsByTable = new Map<string, number>();
    selectedColumns?.forEach((column) => {
      const tableName = column.split(':')[0];
      columnsByTable.set(tableName, (columnsByTable.get(tableName) || 0) + 1);
    });
    const largestTable = selectedColumns === null
      ? (somenteConsumo ? 10 : 11)
      : Math.max(0, ...columnsByTable.values());
    const landscape = largestTable > 8;
    const pages: string[][] = [[]];
    const pageWidth = landscape ? 842 : 595;
    const pageHeight = landscape ? 595 : 842;
    const margin = 36;
    let y = pageHeight - margin;
    const hasSection = (section: string) => selectedSections.has(section);
    const hasColumn = (tableName: string, column: string) => selectedColumns === null || selectedColumns.has(`${tableName}:${column}`);

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
      const drawHeader = () => {
        rect(margin, y, tableWidth, rowHeight, [31, 122, 140]);
        let headerX = margin;
        headers.forEach((header, index) => {
          const clipped = this.truncatePdfText(header, Math.max(8, Math.floor(widths[index] / 4.6)));
          text(clipped, headerX + 7, y - 15, { size: 8.5, font: 'bold', color: [255, 255, 255] });
          headerX += widths[index];
        });
        y -= rowHeight;
      };

      ensureSpace(rowHeight * 2);
      drawHeader();

      for (const [rowIndex, row] of values.entries()) {
        if (y - rowHeight < 58) {
          newPage();
          drawHeader();
        }
        if (rowIndex % 2 === 0) rect(margin, y, tableWidth, rowHeight, [248, 250, 252]);
        let x = margin;
        row.forEach((value, index) => {
          const clipped = this.truncatePdfText(value, Math.max(8, Math.floor(widths[index] / 4.6)));
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
    const configurableTable = (
      tableName: string,
      columns: Array<{
        key: string;
        header: string;
        width: number;
        align?: 'left' | 'right';
        value: (item: any) => string;
      }>,
      values: any[],
    ) => {
      const activeColumns = columns.filter((column) => hasColumn(tableName, column.key));
      if (!activeColumns.length) {
        emptyMessage('Selecione ao menos uma coluna para exibir esta seção.');
        return;
      }
      const availableWidth = pageWidth - margin * 2;
      const originalWidth = activeColumns.reduce((sum, column) => sum + column.width, 0);
      const widths = activeColumns.map((column) => Math.floor((column.width / originalWidth) * availableWidth));
      widths[widths.length - 1] += availableWidth - widths.reduce((sum, width) => sum + width, 0);
      table(
        activeColumns.map((column) => column.header),
        values.map((item) => activeColumns.map((column) => column.value(item))),
        widths,
        activeColumns.map((column) => column.align || 'left'),
      );
    };

    rect(0, pageHeight, pageWidth, 92, [15, 48, 63]);
    rect(0, pageHeight - 92, pageWidth, 5, [31, 122, 140]);
    text('Controle Transporte', margin, pageHeight - 43, { size: 11, font: 'bold', color: [148, 213, 220] });
    text(
      somenteConsumo ? 'Relatório de média da frota' : filters.tipoRelatorio === 'RELATORIO_COMBINADO' ? 'Relatório Combinado' : 'Registro Geral',
      margin,
      pageHeight - 67,
      { size: 17, font: 'bold', color: [255, 255, 255] },
    );
    text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin, pageHeight - 47, { size: 9, align: 'right', color: [203, 213, 225] });
    text(
      somenteConsumo ? `${relatorio.total} abastecimentos` : `${relatorio.total} lançamentos`,
      pageWidth - margin,
      pageHeight - 68,
      { size: 10, font: 'bold', align: 'right', color: [255, 255, 255] },
    );
    y = pageHeight - 120;

    if (!somenteConsumo) {
      if (hasSection('resumo_financeiro')) {
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
      }

      if (hasSection('lancamentos')) {
        sectionTitle('Lançamentos encontrados');
        if (rows.length) {
          configurableTable('lancamentos', [
            { key: 'data', header: 'Data', width: 58, value: (item) => this.formatDate(item.data) },
            { key: 'tipo', header: 'Tipo', width: 78, value: (item) => item.tipoLancamento === TipoLancamento.DESPESA ? 'Despesa' : 'Faturamento' },
            { key: 'cavalo', header: 'Placa', width: 62, value: (item) => item.cavaloMecanico?.placa || item.placa || '-' },
            { key: 'conjunto', header: 'Conjunto', width: 96, value: (item) => item.conjunto?.nome || '-' },
            { key: 'implementos', header: 'Implementos', width: 118, value: (item) => this.formatImplementosConjunto(item.conjunto) || item.implemento?.placa || '-' },
            { key: 'motorista', header: 'Motorista', width: 116, value: (item) => item.motorista?.nome || '-' },
            { key: 'parte', header: 'Fornecedor/cliente', width: 116, value: (item) => item.fornecedor?.nome || item.cliente?.nome || '-' },
            { key: 'categoria', header: 'Categoria', width: 104, value: (item) => item.categoriaFinanceira?.nome || '-' },
            { key: 'quantidade', header: 'Quantidade', width: 70, align: 'right', value: (item) => `${this.formatDecimal(item.quantidade, 3)} ${item.unidadeQuantidade}` },
            { key: 'valorUnitario', header: 'Valor unit.', width: 90, align: 'right', value: (item) => this.formatCurrency(item.valorUnitario) },
            { key: 'valorTotal', header: 'Valor total', width: 105, align: 'right', value: (item) => this.formatCurrency(item.valorTotal) },
          ], rows);
        } else {
          emptyMessage('Nenhum lançamento encontrado para os filtros informados.');
        }
      }

      if (['grupos_cavalo', 'grupos_placas', 'grupos_motorista', 'grupos_clientes', 'grupos_fornecedores', 'grupos_categorias', 'grupos_implementos', 'grupos_conjuntos', 'grupos_tipos_conjunto', 'grupos_eixos', 'grupos_tipos_financeiros'].some(hasSection)) {
        sectionTitle('Totais separados por grupo');
        if (hasSection('grupos_cavalo')) {
          table(['Despesas por cavalo mecânico', 'Total'], this.pdfGroupRows(relatorio.despesasPorCavaloMecanico), [390, 133], ['left', 'right']);
          table(['Faturamento por cavalo mecânico', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorCavaloMecanico), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_placas')) {
          table(['Despesas por placa registrada', 'Total'], this.pdfGroupRows(relatorio.despesasPorPlaca), [390, 133], ['left', 'right']);
          table(['Faturamento por placa registrada', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorPlaca), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_motorista')) {
          table(['Despesas por motorista', 'Total'], this.pdfGroupRows(relatorio.despesasPorMotorista), [390, 133], ['left', 'right']);
          table(['Faturamento por motorista', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorMotorista), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_clientes')) {
          table(['Despesas por cliente', 'Total'], this.pdfGroupRows(relatorio.despesasPorCliente), [390, 133], ['left', 'right']);
          table(['Faturamento por cliente', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorCliente), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_fornecedores')) {
          table(['Despesas por fornecedor', 'Total'], this.pdfGroupRows(relatorio.despesasPorFornecedor), [390, 133], ['left', 'right']);
          table(['Faturamento por fornecedor', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorFornecedor), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_categorias')) {
          table(['Despesas por categoria financeira', 'Total'], this.pdfGroupRows(relatorio.despesasPorCategoria), [390, 133], ['left', 'right']);
          table(['Faturamento por categoria financeira', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorCategoria), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_implementos')) {
          table(['Despesas por implemento', 'Total'], this.pdfGroupRows(relatorio.despesasPorImplemento), [390, 133], ['left', 'right']);
          table(['Faturamento por implemento', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorImplemento), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_conjuntos')) {
          table(['Despesas por conjunto operacional', 'Total'], this.pdfGroupRows(relatorio.despesasPorConjunto), [390, 133], ['left', 'right']);
          table(['Faturamento por conjunto operacional', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorConjunto), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_tipos_conjunto')) {
          table(['Despesas por tipo de conjunto', 'Total'], this.pdfGroupRows(relatorio.despesasPorTipoConjunto), [390, 133], ['left', 'right']);
          table(['Faturamento por tipo de conjunto', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorTipoConjunto), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_eixos')) {
          table(['Despesas por quantidade de eixos', 'Total'], this.pdfGroupRows(relatorio.despesasPorQuantidadeEixos), [390, 133], ['left', 'right']);
          table(['Faturamento por quantidade de eixos', 'Total'], this.pdfGroupRows(relatorio.faturamentoPorQuantidadeEixos), [390, 133], ['left', 'right']);
        }
        if (hasSection('grupos_tipos_financeiros')) {
          table(
            ['Tipo financeiro', 'Valor total'],
            [['Despesas', this.formatCurrency(relatorio.totalDespesas)], ['Faturamento', this.formatCurrency(relatorio.totalFaturamento)]],
            [390, 133],
            ['left', 'right'],
          );
        }
      }

      if (hasSection('composicoes')) {
        sectionTitle('Resumo por composição do cavalo');
        if (relatorio.conjuntosPorCavalo.length) {
          configurableTable('composicoes', [
            { key: 'cavalo', header: 'Cavalo', width: 90, value: (item) => item.cavalo || '-' },
            { key: 'conjunto', header: 'Conjunto', width: 96, value: (item) => item.conjunto || '-' },
            { key: 'tipo', header: 'Tipo', width: 56, value: (item) => item.tipoConjunto || '-' },
            { key: 'eixos', header: 'Eixos', width: 42, align: 'right', value: (item) => String(item.quantidadeTotalEixos ?? '-') },
            { key: 'implementos', header: 'Implementos', width: 110, value: (item) => item.implementos || '-' },
            { key: 'lancamentos', header: 'Lanc.', width: 42, align: 'right', value: (item) => String(item.quantidadeLancamentos) },
            { key: 'despesas', header: 'Despesas', width: 78, align: 'right', value: (item) => this.formatCurrency(item.totalDespesas) },
            { key: 'faturamento', header: 'Faturamento', width: 88, align: 'right', value: (item) => this.formatCurrency(item.totalFaturamento) },
            { key: 'saldo', header: 'Saldo', width: 73, align: 'right', value: (item) => this.formatCurrency(item.saldo) },
          ], relatorio.conjuntosPorCavalo);
        } else {
          emptyMessage('Nenhum conjunto encontrado para os filtros informados.');
        }
      }

      if (hasSection('comissoes')) {
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
          configurableTable('comissoes', [
            { key: 'data', header: 'Data', width: 45, value: (item) => this.formatDate(item.data) },
            { key: 'cavalo', header: 'Cavalo', width: 50, value: (item) => item.cavaloMecanico?.placa || item.placa || '-' },
            { key: 'motorista', header: 'Motorista', width: 75, value: (item) => item.motorista?.nome || '-' },
            { key: 'eixos', header: 'Eixos', width: 30, align: 'right', value: (item) => String(item.quantidadeEixosComissao) },
            { key: 'tipo', header: 'Tipo', width: 55, value: (item) => this.commissionTypeLabel(item.tipoComissao) },
            { key: 'regra', header: 'Regra', width: 60, align: 'right', value: (item) => this.commissionRuleLabel(item) },
            { key: 'faturamento', header: 'Faturamento', width: 65, align: 'right', value: (item) => this.formatCurrency(item.valorTotal) },
            { key: 'bruta', header: 'Bruta', width: 48, align: 'right', value: (item) => this.formatCurrency(item.valorComissaoBruta ?? item.valorComissao) },
            { key: 'impostos', header: 'Impostos', width: 48, align: 'right', value: (item) => this.formatCurrency(item.valorDescontoImpostos || 0) },
            { key: 'liquida', header: 'Líquida', width: 47, align: 'right', value: (item) => this.formatCurrency(item.valorComissao) },
            { key: 'aposComissao', header: 'Após comissão', width: 65, align: 'right', value: (item) => this.formatCurrency(Number(item.valorTotal || 0) - Number(item.valorComissao || 0)) },
          ], relatorio.comissoes.historico);
        } else {
          emptyMessage('Nenhuma comissão encontrada para os filtros informados.');
        }
      }
    }

    if (somenteConsumo) {
      const consumo = relatorio.consumo;
      if (!consumo.resumo.quantidadeRegistros) {
        emptyMessage('Nenhum abastecimento encontrado para os filtros informados.');
      } else {
        if (hasSection('resumo_frota')) {
          sectionTitle('Média da frota');
          table(
            ['Média da frota', 'Melhor placa', 'Menor média', 'Divergências'],
            [[
              `${this.formatDecimal(consumo.resumo.mediaGeralKmLitro, 2)} km/l`,
              consumo.resumo.melhorPlaca
                ? `${consumo.resumo.melhorPlaca.placa} - ${this.formatDecimal(consumo.resumo.melhorPlaca.mediaGeralKmLitro, 2)}`
                : '-',
              consumo.resumo.piorPlaca
                ? `${consumo.resumo.piorPlaca.placa} - ${this.formatDecimal(consumo.resumo.piorPlaca.mediaGeralKmLitro, 2)}`
                : '-',
              String(consumo.resumo.quantidadeDivergencias || 0),
            ]],
            [130, 145, 145, 103],
            ['right', 'right', 'right', 'right'],
          );
        }

        if (hasSection('ranking_frota')) {
          sectionTitle('Ranking da frota');
          configurableTable('ranking', [
            { key: 'posicao', header: 'Pos.', width: 27, align: 'right', value: (item) => item.posicao == null ? '-' : String(item.posicao) },
            { key: 'placa', header: 'Placa', width: 55, value: (item) => item.placa || '-' },
            { key: 'abastecimentos', header: 'Abast.', width: 42, align: 'right', value: (item) => String(item.quantidadeRegistros) },
            { key: 'distancia', header: 'Dist.', width: 62, align: 'right', value: (item) => this.formatDecimal(item.distanciaTotal, 1) },
            { key: 'litros', header: 'Litros', width: 62, align: 'right', value: (item) => this.formatDecimal(item.litrosTotal, 2) },
            { key: 'media', header: 'Média', width: 55, align: 'right', value: (item) => this.formatDecimal(item.mediaGeralKmLitro, 2) },
            { key: 'mediaAnterior', header: 'Ant.', width: 55, align: 'right', value: (item) => item.mediaPeriodoAnterior == null ? '-' : this.formatDecimal(item.mediaPeriodoAnterior, 2) },
            { key: 'variacao', header: 'Var.%', width: 50, align: 'right', value: (item) => item.variacaoPercentual == null ? '-' : this.formatDecimal(item.variacaoPercentual, 2) },
            { key: 'divergencias', header: 'Diverg.', width: 52, align: 'right', value: (item) => String(item.quantidadeDivergencias) },
            { key: 'amostra', header: 'Amostra', width: 63, value: (item) => item.amostraConfiavel ? 'OK' : 'Pequena' },
          ], consumo.porCavalo);
        }

        if (hasSection('comparacao_periodo')) {
          sectionTitle('Comparação com período anterior');
          if (consumo.periodoComparacao) {
            table(
              ['Período anterior comparado'],
              [[`${consumo.periodoComparacao.dataInicial.split('-').reverse().join('/')} a ${consumo.periodoComparacao.dataFinal.split('-').reverse().join('/')}`]],
              [523],
              ['left'],
            );
            configurableTable('comparacao', [
              { key: 'placa', header: 'Placa', width: 120, value: (item) => item.placa || '-' },
              { key: 'mediaAtual', header: 'Média atual', width: 135, align: 'right', value: (item) => this.formatDecimal(item.mediaGeralKmLitro, 2) },
              { key: 'mediaAnterior', header: 'Média anterior', width: 135, align: 'right', value: (item) => item.mediaPeriodoAnterior == null ? '-' : this.formatDecimal(item.mediaPeriodoAnterior, 2) },
              { key: 'variacao', header: 'Variação %', width: 133, align: 'right', value: (item) => item.variacaoPercentual == null ? '-' : this.formatDecimal(item.variacaoPercentual, 2) },
            ], consumo.porCavalo);
          } else {
            emptyMessage('Informe data inicial e final para comparar com o período anterior.');
          }
        }

        if (hasSection('historico_abastecimentos')) {
          sectionTitle('Histórico de abastecimentos');
          configurableTable('historico', [
            { key: 'data', header: 'Data', width: 58, value: (item) => this.formatDate(item.data) },
            { key: 'cavalo', header: 'Cavalo', width: 58, value: (item) => item.cavaloMecanico?.placa || '-' },
            { key: 'kmAnterior', header: 'Km anterior', width: 78, align: 'right', value: (item) => this.formatDecimal(item.kmAnterior, 1) },
            { key: 'kmAtual', header: 'Km atual', width: 78, align: 'right', value: (item) => this.formatDecimal(item.kmAtual, 1) },
            { key: 'distancia', header: 'Distância', width: 65, align: 'right', value: (item) => this.formatDecimal(item.distanciaPercorrida, 1) },
            { key: 'litros', header: 'Litros', width: 60, align: 'right', value: (item) => this.formatDecimal(item.litros, 2) },
            { key: 'media', header: 'Média', width: 78, align: 'right', value: (item) => `${this.formatDecimal(item.mediaKmLitro, 2)} km/l` },
            { key: 'status', header: 'Status', width: 48, value: (item) => item.divergente ? 'Divergente' : 'OK' },
          ], consumo.historico);
        }
      }
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

  private lancamentoOrderBy(filters: RelatorioFinanceiroQueryDto): object[] {
    const direction = filters.orderDirection === 'asc' ? 'asc' : 'desc';
    const sortableFields: Record<string, object[]> = {
      data: [{ data: direction }],
      tipoLancamento: [{ tipoLancamento: direction }],
      cavalo: [{ placa: direction }],
      conjunto: [{ conjunto: { nome: direction } }],
      motorista: [{ motorista: { nome: direction } }],
      parte: [{ fornecedor: { nome: direction } }, { cliente: { nome: direction } }],
      categoria: [{ categoriaFinanceira: { nome: direction } }],
      quantidade: [{ quantidade: direction }],
      valorUnitario: [{ valorUnitario: direction }],
      valorTotal: [{ valorTotal: direction }],
    };
    return [
      ...(sortableFields[filters.orderBy || 'data'] || sortableFields.data),
      { createdAt: 'desc' },
    ];
  }

  private async sum(where: any) {
    const result = await this.prisma.lancamentoFinanceiro.aggregate({ where, _sum: { valorTotal: true } });
    return Number(result._sum.valorTotal || 0);
  }

  private async group(by: FinancialGroupField, where: any) {
    const excludeNull = by !== 'motoristaId' && by !== 'placa';
    const groupWhere = excludeNull ? { ...where, [by]: { not: null } } : where;
    return this.prisma.lancamentoFinanceiro.groupBy({
      by: [by],
      where: groupWhere,
      _sum: { valorTotal: true },
    });
  }

  private async groupWithLabels(by: Exclude<FinancialGroupField, 'conjuntoId'>, where: any) {
    const rows = await this.group(by, where);
    const ids = rows.map((row) => row[by]).filter(Boolean) as string[];

    const labels = new Map<string, string>();
    if (by === 'placa') {
      ids.forEach((id) => labels.set(id, id));
    } else if (by === 'cavaloMecanicoId') {
      const cavalos = await this.prisma.cavaloMecanico.findMany({
        where: { id: { in: ids } },
        select: { id: true, placa: true, marca: true, modelo: true },
      });
      cavalos.forEach((item) => labels.set(item.id, [item.placa, item.marca, item.modelo].filter(Boolean).join(' - ')));
    } else if (by === 'motoristaId') {
      const motoristas = await this.prisma.motorista.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true, cpf: true },
      });
      motoristas.forEach((item) => labels.set(item.id, [item.nome, item.cpf].filter(Boolean).join(' - ')));
    } else if (by === 'clienteId') {
      const clientes = await this.prisma.cliente.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true, documento: true },
      });
      clientes.forEach((item) => labels.set(item.id, [item.nome, item.documento].filter(Boolean).join(' - ')));
    } else if (by === 'fornecedorId') {
      const fornecedores = await this.prisma.fornecedor.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true, documento: true },
      });
      fornecedores.forEach((item) => labels.set(item.id, [item.nome, item.documento].filter(Boolean).join(' - ')));
    } else if (by === 'categoriaId') {
      const categorias = await this.prisma.categoriaFinanceira.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true },
      });
      categorias.forEach((item) => labels.set(item.id, item.nome));
    } else {
      const implementos = await this.prisma.implemento.findMany({
        where: { id: { in: ids } },
        select: { id: true, placa: true, tipo: true, carroceria: true },
      });
      implementos.forEach((item) => labels.set(item.id, [item.placa, item.tipo, item.carroceria].filter(Boolean).join(' - ')));
    }

    return rows.map((row) => ({
      id: row[by],
      label: labels.get(row[by] || '') || 'Sem cadastro',
      total: Number(row._sum.valorTotal || 0),
    })).sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, 'pt-BR'));
  }

  private async operationalDimensionGroups(where: any) {
    const [porPlaca, porImplemento, conjuntoRows] = await Promise.all([
      this.groupWithLabels('placa', where),
      this.groupWithLabels('implementoId', where),
      this.group('conjuntoId', where),
    ]);
    const conjuntoIds = conjuntoRows.map((row) => row.conjuntoId).filter(Boolean) as string[];
    const conjuntos = await this.prisma.conjunto.findMany({
      where: { id: { in: conjuntoIds } },
      select: {
        id: true,
        nome: true,
        tipo: true,
        quantidadeTotalEixos: true,
        implementos: { select: { implemento: { select: { id: true, placa: true, tipo: true, carroceria: true } } } },
      },
    });
    const conjuntosById = new Map(conjuntos.map((item) => [item.id, item]));
    const porConjunto = conjuntoRows.map((row) => {
      const conjunto = conjuntosById.get(row.conjuntoId || '');
      return {
        id: row.conjuntoId,
        label: conjunto ? [conjunto.nome, conjunto.tipo, `${conjunto.quantidadeTotalEixos} eixos`].join(' - ') : 'Sem cadastro',
        total: Number(row._sum.valorTotal || 0),
      };
    });
    const consolidate = (labelFor: (item: typeof conjuntos[number]) => string) => {
      const totals = new Map<string, number>();
      conjuntoRows.forEach((row) => {
        const conjunto = conjuntosById.get(row.conjuntoId || '');
        if (!conjunto) return;
        const label = labelFor(conjunto);
        totals.set(label, (totals.get(label) || 0) + Number(row._sum.valorTotal || 0));
      });
      return [...totals.entries()].map(([label, total]) => ({ id: label, label, total }));
    };
    const sortRows = (rows: Array<{ id: string | null; label: string; total: number }>) => rows
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, 'pt-BR'));
    const implementoTotals = new Map(porImplemento.map((item) => [item.id, { ...item }]));
    conjuntoRows.forEach((row) => {
      const conjunto = conjuntosById.get(row.conjuntoId || '');
      conjunto?.implementos?.forEach(({ implemento }) => {
        const current = implementoTotals.get(implemento.id);
        const total = Number(row._sum.valorTotal || 0);
        implementoTotals.set(implemento.id, {
          id: implemento.id,
          label: [implemento.placa, implemento.tipo, implemento.carroceria].filter(Boolean).join(' - '),
          total: (current?.total || 0) + total,
        });
      });
    });

    return {
      porPlaca,
      porImplemento: sortRows([...implementoTotals.values()]),
      porConjunto: sortRows(porConjunto),
      porTipoConjunto: sortRows(consolidate((item) => this.tipoConjuntoLabel(item.tipo))),
      porQuantidadeEixos: sortRows(consolidate((item) => `${item.quantidadeTotalEixos} eixos`)),
    };
  }

  private async comissoes(filters: RelatorioFinanceiroQueryDto, take = 50) {
    const commissionFilters = {
      ...filters,
      tipoLancamento: undefined,
      tiposLancamento: undefined,
      categoriaId: undefined,
      categoriaIds: undefined,
      quantidadeEixos: undefined,
      quantidadesEixos: undefined,
    };
    const baseWhere: any = await this.buildWhere(commissionFilters);
    const and = [...(baseWhere.AND || [])];
    const categoriaIds = this.filterValues(filters.categoriaIds || filters.categoriaId);
    if (categoriaIds.length) {
      and.push({
        OR: [
          { categoriaId: { in: categoriaIds } },
          { despesaComissao: { is: { categoriaId: { in: categoriaIds } } } },
        ],
      });
    }
    const quantidadesEixos = this.filterValues(filters.quantidadesEixos || filters.quantidadeEixos).map(Number).filter(Number.isFinite);
    if (quantidadesEixos.length) {
      and.push({ quantidadeEixosComissao: { in: quantidadesEixos } });
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
        orderBy: this.lancamentoOrderBy(filters),
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
    const periodoAnterior = this.periodoAnteriorConsumo(filters);
    const wherePeriodoAnterior = periodoAnterior
      ? {
        ...this.buildAbastecimentoWhere({ ...filters, dataInicial: undefined, dataFinal: undefined }),
        data: { gte: periodoAnterior.inicio, lte: periodoAnterior.fim },
      }
      : null;
    const [totais, grupos, gruposPeriodoAnterior, registros] = await Promise.all([
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
      wherePeriodoAnterior
        ? this.prisma.abastecimento.groupBy({
          by: ['cavaloMecanicoId'],
          where: wherePeriodoAnterior,
          _count: { _all: true },
          _sum: { distanciaPercorrida: true, litros: true },
        })
        : Promise.resolve([]),
      this.prisma.abastecimento.findMany({
        where,
        include: { cavaloMecanico: true },
        orderBy: [{ cavaloMecanicoId: 'asc' }, { data: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    const ids = grupos.map((item) => item.cavaloMecanicoId);
    const cavalos = await this.prisma.cavaloMecanico.findMany({
      where: { id: { in: ids } },
      select: { id: true, placa: true, marca: true, modelo: true },
    });
    const cavalosPorId = new Map(cavalos.map((item) => [item.id, item]));
    const anterioresPorCavalo = new Map(gruposPeriodoAnterior.map((item) => {
      const distancia = Number(item._sum.distanciaPercorrida || 0);
      const litros = Number(item._sum.litros || 0);
      return [item.cavaloMecanicoId, litros > 0 ? distancia / litros : 0];
    }));
    const divergencias = new Set<string>();
    const divergenciasPorCavalo = new Map<string, number>();
    const anteriorPorCavalo = new Map<string, any>();
    for (const item of registros) {
      const anterior = anteriorPorCavalo.get(item.cavaloMecanicoId);
      if (anterior && Number(anterior.kmAtual) !== Number(item.kmAnterior)) {
        divergencias.add(anterior.id);
        divergencias.add(item.id);
        divergenciasPorCavalo.set(item.cavaloMecanicoId, (divergenciasPorCavalo.get(item.cavaloMecanicoId) || 0) + 1);
      }
      anteriorPorCavalo.set(item.cavaloMecanicoId, item);
    }
    const distanciaTotal = Number(totais._sum.distanciaPercorrida || 0);
    const litrosTotal = Number(totais._sum.litros || 0);
    const porCavalo = grupos
      .map((item) => {
        const distancia = Number(item._sum.distanciaPercorrida || 0);
        const litros = Number(item._sum.litros || 0);
        const media = litros > 0 ? distancia / litros : 0;
        const mediaAnterior = anterioresPorCavalo.get(item.cavaloMecanicoId);
        const cavalo = cavalosPorId.get(item.cavaloMecanicoId);
        return {
          cavaloMecanicoId: item.cavaloMecanicoId,
          placa: cavalo?.placa || 'Sem placa',
          cavalo: cavalo ? [cavalo.placa, cavalo.marca, cavalo.modelo].filter(Boolean).join(' - ') : 'Sem cadastro',
          quantidadeRegistros: item._count._all,
          distanciaTotal: distancia,
          litrosTotal: litros,
          mediaGeralKmLitro: media,
          mediaPeriodoAnterior: mediaAnterior ?? null,
          variacaoPercentual: mediaAnterior && mediaAnterior > 0
            ? Number((((media - mediaAnterior) / mediaAnterior) * 100).toFixed(2))
            : null,
          quantidadeDivergencias: divergenciasPorCavalo.get(item.cavaloMecanicoId) || 0,
          amostraConfiavel: item._count._all >= 2,
        };
      })
      .sort((a, b) => Number(b.amostraConfiavel) - Number(a.amostraConfiavel) || b.mediaGeralKmLitro - a.mediaGeralKmLitro);
    let posicao = 0;
    const rankingPorCavalo = porCavalo.map((item) => ({
      ...item,
      posicao: item.amostraConfiavel ? ++posicao : null,
    }));
    const placasComAmostraConfiavel = rankingPorCavalo.filter((item) => item.amostraConfiavel);

    return {
      resumo: {
        quantidadeRegistros: totais._count._all,
        distanciaTotal,
        litrosTotal,
        mediaGeralKmLitro: litrosTotal > 0 ? distanciaTotal / litrosTotal : 0,
        placasAnalisadas: rankingPorCavalo.length,
        melhorPlaca: placasComAmostraConfiavel[0] || null,
        piorPlaca: placasComAmostraConfiavel[placasComAmostraConfiavel.length - 1] || null,
        quantidadeDivergencias: [...divergenciasPorCavalo.values()].reduce((total, quantidade) => total + quantidade, 0),
      },
      periodoComparacao: periodoAnterior
        ? { dataInicial: periodoAnterior.dataInicial, dataFinal: periodoAnterior.dataFinal }
        : null,
      porCavalo: rankingPorCavalo,
      historico: [...registros]
        .sort((a, b) => {
          const data = b.data.getTime() - a.data.getTime();
          return data || b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(0, take)
        .map((item) => ({ ...item, divergente: divergencias.has(item.id) })),
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






