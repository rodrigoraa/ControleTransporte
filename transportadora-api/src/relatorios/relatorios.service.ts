import { Injectable } from '@nestjs/common';
import { Prisma, TipoLancamento } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RelatorioFinanceiroQueryDto } from './dto/relatorio-financeiro-query.dto';

type PdfTextOptions = {
  size?: number;
  font?: 'regular' | 'bold';
  color?: [number, number, number];
  align?: 'left' | 'right' | 'center';
};

type FinancialGroupField = 'placa' | 'cavaloMecanicoId' | 'motoristaId' | 'clienteId' | 'fornecedorId' | 'categoriaId' | 'implementoId' | 'conjuntoId';

const FINANCIAL_REPORT_SECTIONS = [
  'resumo_financeiro',
  'lancamentos',
  'grupos_cavalo',
  'grupos_placas',
  'grupos_motorista',
  'grupos_clientes',
  'grupos_fornecedores',
  'grupos_categorias',
  'grupos_implementos',
  'grupos_conjuntos',
  'grupos_tipos_conjunto',
  'grupos_eixos',
  'grupos_tipos_financeiros',
  'composicoes',
  'comissoes',
] as const;

const FLEET_REPORT_SECTIONS = [
  'resumo_frota',
  'ranking_frota',
  'comparacao_periodo',
  'historico_abastecimentos',
] as const;

const EXPORT_BATCH_SIZE = 1000;

const LANCAMENTO_REPORT_INCLUDE = Prisma.validator<Prisma.LancamentoFinanceiroInclude>()({
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
        orderBy: { ordem: 'asc' },
      },
    },
  },
});

type LancamentoReportRow = Prisma.LancamentoFinanceiroGetPayload<{ include: typeof LANCAMENTO_REPORT_INCLUDE }>;

const ABASTECIMENTO_REPORT_INCLUDE = Prisma.validator<Prisma.AbastecimentoInclude>()({ cavaloMecanico: true });
type AbastecimentoReportRow = Prisma.AbastecimentoGetPayload<{ include: typeof ABASTECIMENTO_REPORT_INCLUDE }>;

type FinancialGroupRow = { id: string | null; label: string; total: number };
type CompositionSummaryRow = {
  cavalo: string;
  conjunto: string;
  tipoConjunto: string | null;
  quantidadeTotalEixos: number | null;
  implementos: string;
  quantidadeLancamentos: number;
  totalDespesas: number;
  totalFaturamento: number;
  saldo: number;
};
type FleetSummaryRow = {
  posicao: number | null;
  placa: string;
  cavalo: string;
  quantidadeRegistros: number;
  distanciaTotal: number;
  litrosTotal: number;
  mediaGeralKmLitro: number;
  mediaPeriodoAnterior: number | null;
  variacaoPercentual: number | null;
  quantidadeDivergencias: number;
  amostraConfiavel: boolean;
};
type FleetConsumptionResult = {
  resumo: Record<string, unknown>;
  periodoComparacao: { dataInicial: string; dataFinal: string } | null;
  porCavalo: FleetSummaryRow[];
  historico: Array<AbastecimentoReportRow & { divergente: boolean }>;
};

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
      this.optionRows(filters, ['motoristaId', 'motoristaIds'], { motorista: { select: { id: true, nome: true, cpf: true } } }, ['motoristaId']),
      this.optionRows(filters, ['cavaloMecanicoId', 'cavaloMecanicoIds'], { cavaloMecanico: { select: { id: true, placa: true, marca: true, modelo: true } } }, ['cavaloMecanicoId']),
      this.optionRows(filters, ['implementoId', 'implementoIds'], {
        implemento: { select: { id: true, placa: true, tipo: true, carroceria: true, quantidadeEixos: true } },
        conjunto: { select: { implementos: { select: { implemento: { select: { id: true, placa: true, tipo: true, carroceria: true, quantidadeEixos: true } } } } } },
      }, ['implementoId', 'conjuntoId']),
      this.optionRows(filters, ['conjuntoId', 'conjuntoIds'], { conjunto: { select: { id: true, nome: true, tipo: true, quantidadeTotalEixos: true } } }, ['conjuntoId']),
      this.optionRows(filters, ['fornecedorId', 'fornecedorIds'], { fornecedor: { select: { id: true, nome: true, documento: true } } }, ['fornecedorId']),
      this.optionRows(filters, ['clienteId', 'clienteIds'], { cliente: { select: { id: true, nome: true, documento: true } } }, ['clienteId']),
      this.optionRows(filters, ['categoriaId', 'categoriaIds'], { categoriaFinanceira: { select: { id: true, nome: true, tipoLancamento: true } } }, ['categoriaId']),
      this.optionRows(filters, ['tipoLancamento', 'tiposLancamento'], { tipoLancamento: true }, ['tipoLancamento']),
      this.optionRows(filters, ['tipoConjunto', 'tiposConjunto'], { conjunto: { select: { tipo: true } } }, ['conjuntoId']),
      this.optionRows(filters, ['quantidadeEixos', 'quantidadesEixos'], { conjunto: { select: { quantidadeTotalEixos: true } } }, ['conjuntoId']),
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

  private async optionRows<T extends Prisma.LancamentoFinanceiroSelect>(
    filters: RelatorioFinanceiroQueryDto,
    omittedKeys: Array<keyof RelatorioFinanceiroQueryDto>,
    select: T,
    distinct: Prisma.LancamentoFinanceiroScalarFieldEnum[],
  ) {
    const where = await this.buildWhere(this.withoutFilters(filters, ...omittedKeys));
    return this.prisma.lancamentoFinanceiro.findMany({
      where,
      select,
      distinct,
    });
  }

  private filterValues(value?: string | number | null) {
    if (value === undefined || value === null || value === '') return [];
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }

  private selectedSections(filters: RelatorioFinanceiroQueryDto, fleet = false) {
    const requested = filters.secoes ?? filters.secoesPdf;
    return new Set(requested === undefined
      ? (fleet ? FLEET_REPORT_SECTIONS : FINANCIAL_REPORT_SECTIONS)
      : this.filterValues(requested));
  }

  private selectedColumns(filters: RelatorioFinanceiroQueryDto) {
    const requested = filters.colunas ?? filters.colunasPdf;
    return requested === undefined ? null : new Set(this.filterValues(requested));
  }

  private emptyComissoes() {
    return {
      resumo: { quantidade: 0, totalFaturado: 0, totalComissoes: 0, faturamentoAposComissoes: 0 },
      historico: [],
      historicoTotal: 0,
      historicoLimitado: false,
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
    const sections = this.selectedSections(filters);
    const has = (section: string) => sections.has(section);
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
      despesasPorFornecedor,
      despesasPorCategoria,
      faturamentoPorCavaloMecanico,
      faturamentoPorMotorista,
      faturamentoPorCliente,
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
        has('lancamentos') ? this.prisma.lancamentoFinanceiro.findMany({
          where,
          include: this.lancamentoInclude(),
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }) : Promise.resolve([]),
        has('grupos_cavalo') ? this.groupWithLabels('cavaloMecanicoId', { ...where, tipoLancamento: TipoLancamento.DESPESA }) : Promise.resolve([]),
        has('grupos_motorista') ? this.groupWithLabels('motoristaId', { ...where, tipoLancamento: TipoLancamento.DESPESA }) : Promise.resolve([]),
        has('grupos_fornecedores') ? this.groupWithLabels('fornecedorId', { ...where, tipoLancamento: TipoLancamento.DESPESA }) : Promise.resolve([]),
        has('grupos_categorias') ? this.groupWithLabels('categoriaId', { ...where, tipoLancamento: TipoLancamento.DESPESA }) : Promise.resolve([]),
        has('grupos_cavalo') ? this.groupWithLabels('cavaloMecanicoId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }) : Promise.resolve([]),
        has('grupos_motorista') ? this.groupWithLabels('motoristaId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }) : Promise.resolve([]),
        has('grupos_clientes') ? this.groupWithLabels('clienteId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }) : Promise.resolve([]),
        has('grupos_categorias') ? this.groupWithLabels('categoriaId', { ...where, tipoLancamento: TipoLancamento.FATURAMENTO }) : Promise.resolve([]),
        this.operationalDimensionGroups({ ...where, tipoLancamento: TipoLancamento.DESPESA }, sections),
        this.operationalDimensionGroups({ ...where, tipoLancamento: TipoLancamento.FATURAMENTO }, sections),
        has('composicoes') ? this.conjuntosPorCavalo(where) : Promise.resolve([]),
        has('comissoes') ? this.comissoes(filters) : Promise.resolve(this.emptyComissoes()),
      ]);

    return {
      totalDespesas: despesas,
      totalFaturamento: faturamento,
      saldoFinal: faturamento - despesas,
      despesasPorCavaloMecanico,
      despesasPorMotorista,
      // Campos mantidos vazios para clientes antigos; dados válidos não associam despesa a cliente.
      despesasPorCliente: [],
      despesasPorFornecedor,
      despesasPorCategoria,
      faturamentoPorCavaloMecanico,
      faturamentoPorMotorista,
      faturamentoPorCliente,
      // Campos mantidos vazios para clientes antigos; dados válidos não associam faturamento a fornecedor.
      faturamentoPorFornecedor: [],
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
      secoesCalculadas: [...sections],
    };
  }

  async exportarCsv(filters: RelatorioFinanceiroQueryDto) {
    if (filters.tipoRelatorio === 'MEDIA_FROTA') {
      const consumo = await this.consumo(filters, null);
      return this.csvText(this.consumoCsvRows(consumo, filters));
    }

    const sections = this.selectedSections(filters);
    const summarySections = [...sections].filter((section) => section !== 'lancamentos' && section !== 'comissoes');
    const [relatorio, rows, comissoes] = await Promise.all([
      this.financeiros({ ...filters, secoes: summarySections.join(','), secoesPdf: undefined, page: 1, limit: 1 }),
      sections.has('lancamentos') ? this.exportRows(filters) : Promise.resolve([]),
      sections.has('comissoes') ? this.comissoes(filters, null) : Promise.resolve(this.emptyComissoes()),
    ]);
    relatorio.comissoes = comissoes;
    return this.csvText(this.financialCsvRows(relatorio, rows, filters));
  }

  private financialCsvRows(relatorio: Record<string, unknown>, lancamentos: LancamentoReportRow[], filters: RelatorioFinanceiroQueryDto) {
    const sections = this.selectedSections(filters);
    const selectedColumns = this.selectedColumns(filters);
    const rows: unknown[][] = [];
    const addSection = (title: string, content: unknown[][]) => {
      if (rows.length) rows.push([]);
      rows.push([title], ...content);
    };
    const groupRows = (key: string) => (Array.isArray(relatorio[key]) ? relatorio[key] : []) as FinancialGroupRow[];
    const groupTable = (
      title: string,
      expenseKey: string,
      revenueKey: string,
      note?: string,
      mode: 'both' | 'expenses' | 'revenues' = 'both',
    ) => {
      const totals = new Map<string, { label: string; despesas: number; faturamento: number }>();
      for (const [key, kind] of [[expenseKey, 'despesas'], [revenueKey, 'faturamento']] as const) {
        for (const item of groupRows(key)) {
          const id = String(item.id ?? item.label);
          const current = totals.get(id) || { label: item.label || 'Sem cadastro', despesas: 0, faturamento: 0 };
          current[kind] += Number(item.total || 0);
          totals.set(id, current);
        }
      }
      const content: unknown[][] = [];
      if (note) content.push(['Nota', note]);
      content.push(mode === 'both'
        ? ['Item', 'Despesas', 'Faturamento', 'Saldo']
        : ['Item', mode === 'expenses' ? 'Despesas' : 'Faturamento']);
      content.push(...[...totals.values()]
        .sort((left, right) => Math.max(right.despesas, right.faturamento) - Math.max(left.despesas, left.faturamento))
        .map((item) => mode === 'expenses'
          ? [item.label, this.formatCsvDecimal(item.despesas, 2)]
          : mode === 'revenues'
            ? [item.label, this.formatCsvDecimal(item.faturamento, 2)]
            : [item.label, this.formatCsvDecimal(item.despesas, 2), this.formatCsvDecimal(item.faturamento, 2), this.formatCsvDecimal(item.faturamento - item.despesas, 2)]));
      addSection(title, content);
    };

    if (sections.has('resumo_financeiro')) {
      addSection('Resumo financeiro', [
        ['Total de despesas', 'Total de faturamento', 'Saldo final', 'Lançamentos'],
        [
          this.formatCsvDecimal(relatorio.totalDespesas, 2),
          this.formatCsvDecimal(relatorio.totalFaturamento, 2),
          this.formatCsvDecimal(relatorio.saldoFinal, 2),
          String(relatorio.total || 0),
        ],
      ]);
    }

    if (sections.has('lancamentos')) {
      const columns: Array<{ key: string; header: string; value: (item: LancamentoReportRow) => unknown }> = [
        { key: 'data', header: 'Data', value: (item) => item.data.toISOString().slice(0, 10) },
        { key: 'tipo', header: 'Tipo', value: (item) => item.tipoLancamento },
        { key: 'cavalo', header: 'Cavalo mecânico / placa registrada', value: (item) => item.cavaloMecanico?.placa || item.placa },
        { key: 'conjunto', header: 'Conjunto operacional', value: (item) => item.conjunto?.nome || '' },
        { key: 'implementos', header: 'Implementos utilizados', value: (item) => this.formatImplementosConjunto(item.conjunto) || item.implemento?.placa || '' },
        { key: 'motorista', header: 'Motorista', value: (item) => item.motorista?.nome || '' },
        { key: 'parte', header: 'Fornecedor/Cliente', value: (item) => item.fornecedor?.nome || item.cliente?.nome || '' },
        { key: 'categoria', header: 'Categoria', value: (item) => item.categoriaFinanceira?.nome || '' },
        { key: 'quantidade', header: 'Quantidade', value: (item) => String(item.quantidade) },
        { key: 'valorUnitario', header: 'Valor unitário', value: (item) => this.formatCsvDecimal(item.valorUnitario, 2) },
        { key: 'valorTotal', header: 'Valor total', value: (item) => this.formatCsvDecimal(item.valorTotal, 2) },
      ];
      const active = columns.filter((column) => selectedColumns === null || selectedColumns.has(`lancamentos:${column.key}`));
      addSection('Lançamentos encontrados', [
        active.map((column) => column.header),
        ...lancamentos.map((item) => active.map((column) => column.value(item))),
      ]);
    }

    if (sections.has('grupos_cavalo')) groupTable('Totais por cavalo mecânico atualmente relacionado', 'despesasPorCavaloMecanico', 'faturamentoPorCavaloMecanico');
    if (sections.has('grupos_placas')) groupTable(
      'Placa registrada no lançamento (snapshot histórico)',
      'despesasPorPlaca',
      'faturamentoPorPlaca',
      'Este agrupamento usa a placa gravada no lançamento e pode divergir do cavalo atualmente relacionado.',
    );
    if (sections.has('grupos_motorista')) groupTable('Totais por motorista', 'despesasPorMotorista', 'faturamentoPorMotorista');
    if (sections.has('grupos_clientes')) groupTable('Faturamento por cliente', 'despesasPorCliente', 'faturamentoPorCliente', undefined, 'revenues');
    if (sections.has('grupos_fornecedores')) groupTable('Despesas por fornecedor', 'despesasPorFornecedor', 'faturamentoPorFornecedor', undefined, 'expenses');
    if (sections.has('grupos_categorias')) groupTable('Totais por categoria financeira', 'despesasPorCategoria', 'faturamentoPorCategoria');
    if (sections.has('grupos_implementos')) groupTable(
      'Valores relacionados a implementos (não somáveis)',
      'despesasPorImplemento',
      'faturamentoPorImplemento',
      'O valor integral é relacionado a cada implemento do conjunto; os implementos não devem ser somados entre si.',
    );
    if (sections.has('grupos_conjuntos')) groupTable('Totais por conjunto operacional', 'despesasPorConjunto', 'faturamentoPorConjunto');
    if (sections.has('grupos_tipos_conjunto')) groupTable('Totais por tipo de conjunto', 'despesasPorTipoConjunto', 'faturamentoPorTipoConjunto');
    if (sections.has('grupos_eixos')) groupTable('Totais por quantidade de eixos', 'despesasPorQuantidadeEixos', 'faturamentoPorQuantidadeEixos');
    if (sections.has('grupos_tipos_financeiros')) {
      addSection('Totais por tipo financeiro', [
        ['Item', 'Despesas', 'Faturamento', 'Saldo'],
        [
          'Total geral',
          this.formatCsvDecimal(relatorio.totalDespesas, 2),
          this.formatCsvDecimal(relatorio.totalFaturamento, 2),
          this.formatCsvDecimal(relatorio.saldoFinal, 2),
        ],
      ]);
    }

    if (sections.has('composicoes')) {
      const columns: Array<{ key: string; header: string; value: (item: CompositionSummaryRow) => unknown }> = [
        { key: 'cavalo', header: 'Cavalo', value: (item) => item.cavalo },
        { key: 'conjunto', header: 'Conjunto', value: (item) => item.conjunto },
        { key: 'tipo', header: 'Tipo', value: (item) => item.tipoConjunto || '' },
        { key: 'eixos', header: 'Eixos', value: (item) => item.quantidadeTotalEixos ?? '' },
        { key: 'implementos', header: 'Implementos', value: (item) => item.implementos },
        { key: 'lancamentos', header: 'Lançamentos', value: (item) => item.quantidadeLancamentos },
        { key: 'despesas', header: 'Despesas', value: (item) => this.formatCsvDecimal(item.totalDespesas, 2) },
        { key: 'faturamento', header: 'Faturamento', value: (item) => this.formatCsvDecimal(item.totalFaturamento, 2) },
        { key: 'saldo', header: 'Saldo', value: (item) => this.formatCsvDecimal(item.saldo, 2) },
      ];
      const active = columns.filter((column) => selectedColumns === null || selectedColumns.has(`composicoes:${column.key}`));
      const items = (Array.isArray(relatorio.conjuntosPorCavalo) ? relatorio.conjuntosPorCavalo : []) as CompositionSummaryRow[];
      addSection('Resumo por composição do cavalo', [active.map((column) => column.header), ...items.map((item) => active.map((column) => column.value(item)))]);
    }

    if (sections.has('comissoes')) {
      const comissoes = relatorio.comissoes as { resumo?: Record<string, unknown>; historico?: LancamentoReportRow[] } | undefined;
      const resumo = comissoes?.resumo || {};
      const columns: Array<{ key: string; header: string; value: (item: LancamentoReportRow) => unknown }> = [
        { key: 'data', header: 'Data', value: (item) => item.data.toISOString().slice(0, 10) },
        { key: 'cavalo', header: 'Cavalo', value: (item) => item.cavaloMecanico?.placa || item.placa },
        { key: 'motorista', header: 'Motorista', value: (item) => item.motorista?.nome || '' },
        { key: 'eixos', header: 'Eixos', value: (item) => item.quantidadeEixosComissao ?? '' },
        { key: 'tipo', header: 'Tipo', value: (item) => this.commissionTypeLabel(item.tipoComissao) },
        { key: 'regra', header: 'Regra', value: (item) => this.commissionRuleLabel(item) },
        { key: 'faturamento', header: 'Faturamento', value: (item) => this.formatCsvDecimal(item.valorTotal, 2) },
        { key: 'bruta', header: 'Comissão bruta', value: (item) => this.formatCsvDecimal(item.valorComissaoBruta ?? item.valorComissao, 2) },
        { key: 'impostos', header: 'Impostos', value: (item) => this.formatCsvDecimal(item.valorDescontoImpostos, 2) },
        { key: 'liquida', header: 'Comissão líquida', value: (item) => this.formatCsvDecimal(item.valorComissao, 2) },
        { key: 'aposComissao', header: 'Após comissão', value: (item) => this.formatCsvDecimal(Number(item.valorTotal) - Number(item.valorComissao), 2) },
      ];
      const active = columns.filter((column) => selectedColumns === null || selectedColumns.has(`comissoes:${column.key}`));
      addSection('Comissões dos faturamentos', [
        ['Viagens com comissão', 'Faturamento relacionado', 'Total de comissões', 'Faturamento após comissões'],
        [String(resumo.quantidade || 0), this.formatCsvDecimal(resumo.totalFaturado, 2), this.formatCsvDecimal(resumo.totalComissoes, 2), this.formatCsvDecimal(resumo.faturamentoAposComissoes, 2)],
        [],
        active.map((column) => column.header),
        ...(comissoes?.historico || []).map((item) => active.map((column) => column.value(item))),
      ]);
    }

    return rows;
  }

  private consumoCsvRows(consumo: FleetConsumptionResult, filters: RelatorioFinanceiroQueryDto) {
    const sections = this.selectedSections(filters, true);
    const selectedColumns = this.selectedColumns(filters);
    const rows: unknown[][] = [['Média da frota']];
    const addSection = (title: string, content: unknown[][]) => {
      if (rows.length) rows.push([]);
      rows.push([title], ...content);
    };
    if (sections.has('resumo_frota')) {
      addSection('Resumo da frota', [
        ['Abastecimentos', 'Distância total', 'Litros totais', 'Média geral km/l', 'Cavalos analisados', 'Divergências'],
        [
          consumo.resumo.quantidadeRegistros || 0,
          this.formatCsvDecimal(consumo.resumo.distanciaTotal, 1),
          this.formatCsvDecimal(consumo.resumo.litrosTotal, 2),
          this.formatCsvDecimal(consumo.resumo.mediaGeralKmLitro, 2),
          consumo.resumo.placasAnalisadas || 0,
          consumo.resumo.quantidadeDivergencias || 0,
        ],
      ]);
    }
    if (sections.has('ranking_frota')) {
      const columns: Array<{ key: string; header: string; value: (item: FleetSummaryRow) => unknown }> = [
        { key: 'posicao', header: 'Posição', value: (item) => item.posicao ?? '' },
        { key: 'placa', header: 'Placa', value: (item) => item.placa },
        { key: 'abastecimentos', header: 'Abastecimentos', value: (item) => item.quantidadeRegistros },
        { key: 'distancia', header: 'Distância total', value: (item) => this.formatCsvDecimal(item.distanciaTotal, 1) },
        { key: 'litros', header: 'Litros', value: (item) => this.formatCsvDecimal(item.litrosTotal, 2) },
        { key: 'media', header: 'Média atual km/l', value: (item) => this.formatCsvDecimal(item.mediaGeralKmLitro, 2) },
        { key: 'mediaAnterior', header: 'Média anterior km/l', value: (item) => item.mediaPeriodoAnterior == null ? '' : this.formatCsvDecimal(item.mediaPeriodoAnterior, 2) },
        { key: 'variacao', header: 'Variação %', value: (item) => item.variacaoPercentual == null ? '' : this.formatCsvDecimal(item.variacaoPercentual, 2) },
        { key: 'divergencias', header: 'Divergências', value: (item) => item.quantidadeDivergencias },
        { key: 'amostra', header: 'Amostra', value: (item) => item.amostraConfiavel ? 'Confiável' : 'Amostra pequena' },
      ];
      const active = columns.filter((column) => selectedColumns === null || selectedColumns.has(`ranking:${column.key}`));
      addSection('Ranking da frota', [active.map((column) => column.header), ...consumo.porCavalo.map((item) => active.map((column) => column.value(item)))]);
    }
    if (sections.has('comparacao_periodo')) {
      const columns: Array<{ key: string; header: string; value: (item: FleetSummaryRow) => unknown }> = [
        { key: 'placa', header: 'Placa', value: (item) => item.placa },
        { key: 'mediaAtual', header: 'Média atual km/l', value: (item) => this.formatCsvDecimal(item.mediaGeralKmLitro, 2) },
        { key: 'mediaAnterior', header: 'Média anterior km/l', value: (item) => item.mediaPeriodoAnterior == null ? '' : this.formatCsvDecimal(item.mediaPeriodoAnterior, 2) },
        { key: 'variacao', header: 'Variação %', value: (item) => item.variacaoPercentual == null ? '' : this.formatCsvDecimal(item.variacaoPercentual, 2) },
      ];
      const active = columns.filter((column) => selectedColumns === null || selectedColumns.has(`comparacao:${column.key}`));
      const period = consumo.periodoComparacao
        ? `Período anterior: ${consumo.periodoComparacao.dataInicial} a ${consumo.periodoComparacao.dataFinal}`
        : 'Não disponível: informe data inicial e final.';
      addSection('Comparação com período anterior', [[period], active.map((column) => column.header), ...consumo.porCavalo.map((item) => active.map((column) => column.value(item)))]);
    }
    if (sections.has('historico_abastecimentos')) {
      const columns: Array<{ key: string; header: string; value: (item: FleetConsumptionResult['historico'][number]) => unknown }> = [
        { key: 'data', header: 'Data', value: (item) => item.data.toISOString().slice(0, 10) },
        { key: 'cavalo', header: 'Cavalo mecânico', value: (item) => [item.cavaloMecanico.placa, item.cavaloMecanico.marca, item.cavaloMecanico.modelo].filter(Boolean).join(' - ') },
        { key: 'kmAnterior', header: 'Km anterior', value: (item) => this.formatCsvDecimal(item.kmAnterior, 1) },
        { key: 'kmAtual', header: 'Km atual', value: (item) => this.formatCsvDecimal(item.kmAtual, 1) },
        { key: 'distancia', header: 'Distância', value: (item) => this.formatCsvDecimal(item.distanciaPercorrida, 1) },
        { key: 'litros', header: 'Litros', value: (item) => this.formatCsvDecimal(item.litros, 2) },
        { key: 'media', header: 'Média km/l', value: (item) => this.formatCsvDecimal(item.mediaKmLitro, 2) },
        { key: 'status', header: 'Status', value: (item) => item.divergente ? 'Divergência' : 'Consistente' },
      ];
      const active = columns.filter((column) => selectedColumns === null || selectedColumns.has(`historico:${column.key}`));
      addSection('Histórico de abastecimentos', [active.map((column) => column.header), ...consumo.historico.map((item) => active.map((column) => column.value(item)))]);
    }
    return rows;
  }

  private csvText(rows: unknown[][]) {
    return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
  }

  private formatCsvDecimal(value: unknown, digits: number) {
    return Number(value || 0).toFixed(digits);
  }

  async exportarPdf(filters: RelatorioFinanceiroQueryDto) {
    if (filters.tipoRelatorio === 'MEDIA_FROTA') {
      const consumo = await this.consumo(filters, null);
      return this.styledFinancialPdf(
        { tipoRelatorio: 'MEDIA_FROTA', consumo, total: consumo.resumo.quantidadeRegistros },
        [],
        true,
        filters,
      );
    }

    const sections = this.selectedSections(filters);
    const summarySections = [...sections].filter((section) => section !== 'lancamentos' && section !== 'comissoes');
    const [relatorio, rows, comissoes] = await Promise.all([
      this.financeiros({ ...filters, secoes: summarySections.join(','), secoesPdf: undefined, page: 1, limit: 50 }),
      sections.has('lancamentos') ? this.exportRows(filters) : Promise.resolve([]),
      sections.has('comissoes') ? this.comissoes(filters, null) : Promise.resolve(this.emptyComissoes()),
    ]);
    relatorio.comissoes = comissoes;
    return this.styledFinancialPdf(relatorio, rows, false, filters);
  }

  private async exportRows(filters: RelatorioFinanceiroQueryDto) {
    const where = await this.buildWhere(filters);
    const orderBy = this.lancamentoOrderBy(filters);
    const rows: LancamentoReportRow[] = [];
    let skip = 0;
    while (true) {
      const batch = await this.prisma.lancamentoFinanceiro.findMany({
        where,
        include: this.lancamentoInclude(),
        orderBy,
        skip,
        take: EXPORT_BATCH_SIZE,
      });
      rows.push(...batch);
      if (batch.length < EXPORT_BATCH_SIZE) break;
      skip += batch.length;
    }
    return rows;
  }

  private lancamentoInclude() {
    return LANCAMENTO_REPORT_INCLUDE;
  }

  private styledFinancialPdf(
    relatorio: any,
    rows: any[],
    somenteConsumo = false,
    filters: RelatorioFinanceiroQueryDto = {},
  ) {
    const selectedSections = this.selectedSections(filters, somenteConsumo);
    const selectedColumns = this.selectedColumns(filters);
    const columnsByTable = new Map<string, number>();
    const tableSections: Record<string, string> = {
      lancamentos: 'lancamentos',
      composicoes: 'composicoes',
      comissoes: 'comissoes',
      ranking: 'ranking_frota',
      comparacao: 'comparacao_periodo',
      historico: 'historico_abastecimentos',
    };
    const defaultTableColumns: Record<string, number> = {
      lancamentos: 11,
      composicoes: 9,
      comissoes: 11,
      ranking: 10,
      comparacao: 4,
      historico: 8,
    };
    selectedColumns?.forEach((column) => {
      const tableName = column.split(':')[0];
      if (!selectedSections.has(tableSections[tableName])) return;
      columnsByTable.set(tableName, (columnsByTable.get(tableName) || 0) + 1);
    });
    const largestTable = selectedColumns === null
      ? Math.max(0, ...Object.entries(defaultTableColumns)
        .filter(([tableName]) => selectedSections.has(tableSections[tableName]))
        .map(([, count]) => count))
      : Math.max(0, ...columnsByTable.values());
    const landscape = largestTable > 8;
    const pages: string[][] = [[]];
    const pageWidth = landscape ? 842 : 595;
    const pageHeight = landscape ? 595 : 842;
    const margin = 36;
    const availableWidth = pageWidth - margin * 2;
    let y = pageHeight - margin;
    const hasSection = (section: string) => selectedSections.has(section);
    const hasColumn = (tableName: string, column: string) => selectedColumns === null || selectedColumns.has(`${tableName}:${column}`);
    const reportTitle = somenteConsumo
      ? 'Relatório de média da frota'
      : filters.tipoRelatorio === 'RELATORIO_COMBINADO' ? 'Relatório Financeiro' : 'Registro Geral';

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
      rect(0, pageHeight, pageWidth, 42, [15, 48, 63]);
      rect(0, pageHeight - 42, pageWidth, 3, [31, 122, 140]);
      text(reportTitle, margin, pageHeight - 27, { size: 11, font: 'bold', color: [255, 255, 255] });
      text('Continuação', pageWidth - margin, pageHeight - 27, { size: 8.5, align: 'right', color: [203, 213, 225] });
      y = pageHeight - 62;
    };
    const ensureSpace = (height: number) => {
      if (y - height < 58) newPage();
    };
    const sectionTitle = (title: string, followingHeight = 44) => {
      ensureSpace(38 + followingHeight);
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
      const requestedWidth = widths.reduce((sum, width) => sum + width, 0);
      const fittedWidths = widths.map((width) => Math.floor((width / requestedWidth) * availableWidth));
      fittedWidths[fittedWidths.length - 1] += availableWidth - fittedWidths.reduce((sum, width) => sum + width, 0);
      widths = fittedWidths;
      const tableWidth = availableWidth;
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
    const summaryTable = (
      title: string,
      expenseRows: any[] = [],
      revenueRows: any[] = [],
      note?: string,
      mode: 'both' | 'expenses' | 'revenues' = 'both',
    ) => {
      const totals = new Map<string, { label: string; despesas: number; faturamento: number }>();
      const addRows = (groupRows: any[], kind: 'despesas' | 'faturamento') => groupRows.forEach((row) => {
        const key = String(row.id ?? row.label);
        const current = totals.get(key) || { label: row.label || 'Sem cadastro', despesas: 0, faturamento: 0 };
        current[kind] += Number(row.total || 0);
        totals.set(key, current);
      });
      addRows(expenseRows || [], 'despesas');
      addRows(revenueRows || [], 'faturamento');
      const sorted = [...totals.values()]
        .sort((left, right) => Math.max(right.despesas, right.faturamento) - Math.max(left.despesas, left.faturamento) || left.label.localeCompare(right.label, 'pt-BR'));
      const values = sorted.map((item) => mode === 'expenses'
        ? [item.label, this.formatCurrency(item.despesas)]
        : mode === 'revenues'
          ? [item.label, this.formatCurrency(item.faturamento)]
          : [item.label, this.formatCurrency(item.despesas), this.formatCurrency(item.faturamento), this.formatCurrency(item.faturamento - item.despesas)]);
      sectionTitle(title);
      if (note) {
        ensureSpace(24);
        text(this.truncatePdfText(note, landscape ? 130 : 88), margin, y, { size: 8, color: [71, 85, 105] });
        y -= 18;
      }
      if (!values.length) {
        emptyMessage('Nenhum valor encontrado para este agrupamento.');
        return;
      }
      const moneyWidth = Math.min(125, Math.floor(availableWidth * 0.24));
      if (mode === 'both') {
        table(
          ['Item', 'Despesas', 'Faturamento', 'Saldo'],
          values,
          [availableWidth - moneyWidth * 3, moneyWidth, moneyWidth, moneyWidth],
          ['left', 'right', 'right', 'right'],
        );
      } else {
        table(
          ['Item', mode === 'expenses' ? 'Despesas' : 'Faturamento'],
          values,
          [availableWidth - moneyWidth, moneyWidth],
          ['left', 'right'],
        );
      }
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
      reportTitle,
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

      if (hasSection('grupos_cavalo')) summaryTable('Totais por cavalo mecânico atualmente relacionado', relatorio.despesasPorCavaloMecanico, relatorio.faturamentoPorCavaloMecanico);
      if (hasSection('grupos_placas')) summaryTable(
        'Placa registrada no lançamento (snapshot histórico)',
        relatorio.despesasPorPlaca,
        relatorio.faturamentoPorPlaca,
        'Usa a placa gravada no lançamento e pode divergir do cavalo atualmente relacionado.',
      );
      if (hasSection('grupos_motorista')) summaryTable('Totais por motorista', relatorio.despesasPorMotorista, relatorio.faturamentoPorMotorista);
      if (hasSection('grupos_clientes')) summaryTable('Faturamento por cliente', [], relatorio.faturamentoPorCliente, undefined, 'revenues');
      if (hasSection('grupos_fornecedores')) summaryTable('Despesas por fornecedor', relatorio.despesasPorFornecedor, [], undefined, 'expenses');
      if (hasSection('grupos_categorias')) summaryTable('Totais por categoria financeira', relatorio.despesasPorCategoria, relatorio.faturamentoPorCategoria);
      if (hasSection('grupos_implementos')) summaryTable(
        'Valores relacionados a implementos (não somáveis)',
        relatorio.despesasPorImplemento,
        relatorio.faturamentoPorImplemento,
        'O valor integral é relacionado a cada implemento do conjunto; não some os implementos entre si.',
      );
      if (hasSection('grupos_conjuntos')) summaryTable('Totais por conjunto operacional', relatorio.despesasPorConjunto, relatorio.faturamentoPorConjunto);
      if (hasSection('grupos_tipos_conjunto')) summaryTable('Totais por tipo de conjunto', relatorio.despesasPorTipoConjunto, relatorio.faturamentoPorTipoConjunto);
      if (hasSection('grupos_eixos')) summaryTable('Totais por quantidade de eixos', relatorio.despesasPorQuantidadeEixos, relatorio.faturamentoPorQuantidadeEixos);
      if (hasSection('grupos_tipos_financeiros')) summaryTable(
        'Totais por tipo financeiro',
        [{ id: 'TOTAL', label: 'Total geral', total: relatorio.totalDespesas }],
        [{ id: 'TOTAL', label: 'Total geral', total: relatorio.totalFaturamento }],
      );

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
      const pageLabel = `Página ${index + 1} de ${pages.length}`;
      const pageLabelX = pageWidth - margin - textWidth(pageLabel, 8);
      page.push(`BT /F1 8 Tf ${rgb([100, 116, 139])} rg ${margin} 28 Td (${this.escapePdfText('Controle Transporte')}) Tj ET`);
      page.push(`BT /F1 8 Tf ${rgb([100, 116, 139])} rg ${pageLabelX.toFixed(2)} 28 Td (${this.escapePdfText(pageLabel)}) Tj ET`);
    });

    return this.renderPdf(pages, pageWidth, pageHeight);
  }

  private renderPdf(pages: string[][], pageWidth = 595, pageHeight = 842) {
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
          `${pageObjectIds[index]} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularObjectId} 0 R /F2 ${fontBoldObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >> endobj`,
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
      { id: 'desc' },
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

  private async operationalDimensionGroups(where: any, sections: Set<string>) {
    const needsPlaca = sections.has('grupos_placas');
    const needsImplemento = sections.has('grupos_implementos');
    const needsConjunto = needsImplemento
      || sections.has('grupos_conjuntos')
      || sections.has('grupos_tipos_conjunto')
      || sections.has('grupos_eixos');
    if (!needsPlaca && !needsImplemento && !needsConjunto) {
      return { porPlaca: [], porImplemento: [], porConjunto: [], porTipoConjunto: [], porQuantidadeEixos: [] };
    }
    const [porPlaca, porImplemento, conjuntoRows] = await Promise.all([
      needsPlaca ? this.groupWithLabels('placa', where) : Promise.resolve([]),
      // Quando há conjunto, seus implementos definem a associação. O vínculo direto só é usado sem conjunto,
      // evitando contabilizar duas vezes o mesmo lançamento legado.
      needsImplemento ? this.groupWithLabels('implementoId', { ...where, conjuntoId: null }) : Promise.resolve([]),
      needsConjunto ? this.group('conjuntoId', where) : Promise.resolve([]),
    ]);
    const conjuntoIds = conjuntoRows.map((row) => row.conjuntoId).filter(Boolean) as string[];
    const conjuntos = conjuntoIds.length ? await this.prisma.conjunto.findMany({
      where: { id: { in: conjuntoIds } },
      select: {
        id: true,
        nome: true,
        tipo: true,
        quantidadeTotalEixos: true,
        implementos: { select: { implemento: { select: { id: true, placa: true, tipo: true, carroceria: true } } } },
      },
    }) : [];
    const conjuntosById = new Map(conjuntos.map((item) => [item.id, item]));
    const porConjunto = sections.has('grupos_conjuntos') ? conjuntoRows.map((row) => {
      const conjunto = conjuntosById.get(row.conjuntoId || '');
      return {
        id: row.conjuntoId,
        label: conjunto ? [conjunto.nome, conjunto.tipo, `${conjunto.quantidadeTotalEixos} eixos`].join(' - ') : 'Sem cadastro',
        total: Number(row._sum.valorTotal || 0),
      };
    }) : [];
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
    if (needsImplemento) conjuntoRows.forEach((row) => {
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
      porTipoConjunto: sections.has('grupos_tipos_conjunto') ? sortRows(consolidate((item) => this.tipoConjuntoLabel(item.tipo))) : [],
      porQuantidadeEixos: sections.has('grupos_eixos') ? sortRows(consolidate((item) => `${item.quantidadeTotalEixos} eixos`)) : [],
    };
  }

  private async comissoes(filters: RelatorioFinanceiroQueryDto, historyLimit: number | null = 50) {
    const requestedTypes = this.filterValues(filters.tiposLancamento || filters.tipoLancamento);
    if (requestedTypes.length && !requestedTypes.includes(TipoLancamento.FATURAMENTO)) {
      return this.emptyComissoes();
    }
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
    const totais = await this.prisma.lancamentoFinanceiro.aggregate({
      where,
      _count: { _all: true },
      _sum: { valorTotal: true, valorComissao: true },
    });
    let historico: LancamentoReportRow[];
    if (historyLimit === null) {
      historico = [];
      let skip = 0;
      while (true) {
        const batch = await this.prisma.lancamentoFinanceiro.findMany({
          where,
          include: this.lancamentoInclude(),
          orderBy: this.lancamentoOrderBy(filters),
          skip,
          take: EXPORT_BATCH_SIZE,
        });
        historico.push(...batch);
        if (batch.length < EXPORT_BATCH_SIZE) break;
        skip += batch.length;
      }
    } else {
      historico = await this.prisma.lancamentoFinanceiro.findMany({
        where,
        include: this.lancamentoInclude(),
        orderBy: this.lancamentoOrderBy(filters),
        take: historyLimit,
      });
    }
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
      historicoTotal: totais._count._all,
      historicoLimitado: historyLimit !== null && historico.length < totais._count._all,
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

  private async consumo(filters: RelatorioFinanceiroQueryDto, historyLimit: number | null = 50) {
    const where = this.buildAbastecimentoWhere(filters);
    const sections = this.selectedSections(filters, true);
    const needsSummary = sections.has('resumo_frota');
    const needsGroups = needsSummary || sections.has('ranking_frota') || sections.has('comparacao_periodo');
    const needsRecords = needsSummary || sections.has('ranking_frota') || sections.has('historico_abastecimentos');
    const needsPrevious = sections.has('ranking_frota') || sections.has('comparacao_periodo');
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
      needsGroups ? this.prisma.abastecimento.groupBy({
        by: ['cavaloMecanicoId'],
        where,
        _count: { _all: true },
        _sum: { distanciaPercorrida: true, litros: true },
      }) : Promise.resolve([]),
      wherePeriodoAnterior && needsPrevious
        ? this.prisma.abastecimento.groupBy({
          by: ['cavaloMecanicoId'],
          where: wherePeriodoAnterior,
          _count: { _all: true },
          _sum: { distanciaPercorrida: true, litros: true },
        })
        : Promise.resolve([]),
      needsRecords ? this.findAllAbastecimentos(where) : Promise.resolve([]),
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
        .slice(0, historyLimit ?? registros.length)
        .map((item) => ({ ...item, divergente: divergencias.has(item.id) })),
      historicoTotal: registros.length,
      historicoLimitado: historyLimit !== null && registros.length > historyLimit,
    };
  }

  private async findAllAbastecimentos(where: Prisma.AbastecimentoWhereInput) {
    const rows: AbastecimentoReportRow[] = [];
    let skip = 0;
    while (true) {
      const batch = await this.prisma.abastecimento.findMany({
        where,
        include: ABASTECIMENTO_REPORT_INCLUDE,
        orderBy: [{ cavaloMecanicoId: 'asc' }, { data: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: EXPORT_BATCH_SIZE,
      });
      rows.push(...batch);
      if (batch.length < EXPORT_BATCH_SIZE) break;
      skip += batch.length;
    }
    return rows;
  }

  private async conjuntosPorCavalo(where: any) {
    const grupos = await this.prisma.lancamentoFinanceiro.groupBy({
      by: ['cavaloMecanicoId', 'conjuntoId', 'tipoLancamento'],
      where: { ...where, cavaloMecanicoId: { not: null } },
      _count: { _all: true },
      _sum: { valorTotal: true },
    });
    const cavaloIds = [...new Set(grupos.map((item) => item.cavaloMecanicoId).filter((id): id is string => Boolean(id)))];
    const conjuntoIds = [...new Set(grupos.map((item) => item.conjuntoId).filter((id): id is string => Boolean(id)))];
    const [cavalos, conjuntos] = await Promise.all([
      this.prisma.cavaloMecanico.findMany({
        where: { id: { in: cavaloIds } },
        select: { id: true, placa: true, marca: true, modelo: true },
      }),
      this.prisma.conjunto.findMany({
        where: { id: { in: conjuntoIds } },
        include: { implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' } } },
      }),
    ]);
    const cavalosById = new Map(cavalos.map((item) => [item.id, item]));
    const conjuntosById = new Map(conjuntos.map((item) => [item.id, item]));

    const mapa = new Map<string, any>();
    for (const item of grupos) {
      const cavaloId = item.cavaloMecanicoId || 'sem-cavalo';
      const conjuntoId = item.conjuntoId || 'sem-conjunto';
      const key = `${cavaloId}:${conjuntoId}`;
      if (!mapa.has(key)) {
        const cavalo = cavalosById.get(cavaloId);
        const conjunto = item.conjuntoId ? conjuntosById.get(item.conjuntoId) : null;
        mapa.set(key, {
          cavaloId,
          cavalo: cavalo ? [cavalo.placa, cavalo.marca, cavalo.modelo].filter(Boolean).join(' - ') : 'Sem cadastro',
          conjuntoId: item.conjuntoId,
          conjunto: conjunto?.nome || 'Sem conjunto operacional',
          tipoConjunto: conjunto?.tipo || null,
          quantidadeTotalEixos: conjunto?.quantidadeTotalEixos ?? null,
          capacidadeTotal: conjunto?.capacidadeTotal ? Number(conjunto.capacidadeTotal) : 0,
          implementos: this.formatImplementosConjunto(conjunto),
          quantidadeLancamentos: 0,
          totalDespesas: 0,
          totalFaturamento: 0,
          saldo: 0,
        });
      }
      const row = mapa.get(key);
      const valor = Number(item._sum.valorTotal || 0);
      row.quantidadeLancamentos += item._count._all;
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






