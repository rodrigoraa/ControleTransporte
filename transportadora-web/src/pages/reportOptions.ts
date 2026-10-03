export type ReportType = 'REGISTRO_GERAL' | 'RELATORIO_COMBINADO' | 'MEDIA_FROTA' | 'ULTIMAS_MEDIAS_FROTA';
export type VisibleReportType = Exclude<ReportType, 'REGISTRO_GERAL'>;

export type ReportSelection = {
  sections: string[];
  columns: string[];
};

export type LastGeneratedReport = {
  reportType: VisibleReportType;
  filters: Record<string, string>;
  selection: ReportSelection;
};

export type ReportColumnGroup = {
  id: string;
  label: string;
  sectionId: string;
  columns: Array<{ key: string; label: string }>;
};

export type ReportConfig = {
  sections: Array<{ id: string; label: string }>;
  columnGroups: ReportColumnGroup[];
};

type ReportSelectionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const REPORT_PREFERENCE_VERSION = 3;
const legacyFinancialFilterNames: Record<string, string> = {
  cavaloMecanicoId: 'cavaloMecanicoIds',
  motoristaId: 'motoristaIds',
  implementoId: 'implementoIds',
  conjuntoId: 'conjuntoIds',
  tipoConjunto: 'tiposConjunto',
  quantidadeEixos: 'quantidadesEixos',
  fornecedorId: 'fornecedorIds',
  clienteId: 'clienteIds',
  tipoLancamento: 'tiposLancamento',
  categoriaId: 'categoriaIds',
};
const financialSummarySectionsV2 = ['grupos_clientes', 'grupos_fornecedores', 'grupos_categorias'];
const financialSummarySectionsV3 = ['grupos_placas', 'grupos_implementos', 'grupos_conjuntos', 'grupos_tipos_conjunto', 'grupos_eixos', 'grupos_tipos_financeiros'];

function migrateSelection(reportType: ReportType, selection: ReportSelection, version?: number): ReportSelection {
  if (version === REPORT_PREFERENCE_VERSION || (reportType !== 'REGISTRO_GERAL' && reportType !== 'RELATORIO_COMBINADO')) return selection;
  const sectionsToAdd = [
    ...(version === undefined || version < 2 ? financialSummarySectionsV2 : []),
    ...(version === undefined || version < 3 ? financialSummarySectionsV3 : []),
  ];
  return {
    ...selection,
    sections: [...new Set([...selection.sections, ...sectionsToAdd])],
  };
}

const financialReportConfig: ReportConfig = {
    sections: [
      { id: 'resumo_financeiro', label: 'Resumo financeiro' },
      { id: 'lancamentos', label: 'Lançamentos encontrados' },
      { id: 'grupos_cavalo', label: 'Resumo por cavalo mecânico' },
      { id: 'grupos_placas', label: 'Placa registrada no lançamento (snapshot histórico)' },
      { id: 'grupos_motorista', label: 'Resumo por motorista' },
      { id: 'grupos_clientes', label: 'Faturamento por cliente' },
      { id: 'grupos_fornecedores', label: 'Despesas por fornecedor' },
      { id: 'grupos_categorias', label: 'Totais por categoria financeira' },
      { id: 'grupos_implementos', label: 'Valores relacionados a implementos (não somáveis)' },
      { id: 'grupos_conjuntos', label: 'Totais por conjunto operacional' },
      { id: 'grupos_tipos_conjunto', label: 'Totais por tipo de conjunto' },
      { id: 'grupos_eixos', label: 'Totais por quantidade de eixos' },
      { id: 'grupos_tipos_financeiros', label: 'Totais por tipo financeiro' },
      { id: 'composicoes', label: 'Composição dos cavalos' },
      { id: 'comissoes', label: 'Comissões dos faturamentos' },
    ],
    columnGroups: [
      {
        id: 'lancamentos',
        label: 'Lançamentos encontrados',
        sectionId: 'lancamentos',
        columns: [
          { key: 'data', label: 'Data' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'cavalo', label: 'Cavalo/placa' },
          { key: 'conjunto', label: 'Conjunto registrado' },
          { key: 'implementos', label: 'Implementos utilizados' },
          { key: 'motorista', label: 'Motorista' },
          { key: 'parte', label: 'Fornecedor/cliente' },
          { key: 'categoria', label: 'Categoria' },
          { key: 'quantidade', label: 'Quantidade' },
          { key: 'valorUnitario', label: 'Valor unitário' },
          { key: 'valorTotal', label: 'Valor total' },
        ],
      },
      {
        id: 'composicoes',
        label: 'Composição dos cavalos',
        sectionId: 'composicoes',
        columns: [
          { key: 'cavalo', label: 'Cavalo' },
          { key: 'conjunto', label: 'Conjunto' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'eixos', label: 'Eixos' },
          { key: 'implementos', label: 'Implementos' },
          { key: 'lancamentos', label: 'Lançamentos' },
          { key: 'despesas', label: 'Despesas' },
          { key: 'faturamento', label: 'Faturamento' },
          { key: 'saldo', label: 'Saldo' },
        ],
      },
      {
        id: 'comissoes',
        label: 'Histórico de comissões',
        sectionId: 'comissoes',
        columns: [
          { key: 'data', label: 'Data' },
          { key: 'cavalo', label: 'Cavalo' },
          { key: 'motorista', label: 'Motorista' },
          { key: 'eixos', label: 'Eixos' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'regra', label: 'Regra' },
          { key: 'faturamento', label: 'Faturamento' },
          { key: 'bruta', label: 'Comissão bruta' },
          { key: 'impostos', label: 'Impostos' },
          { key: 'liquida', label: 'Comissão líquida' },
          { key: 'aposComissao', label: 'Após comissão' },
        ],
      },
    ],
};

const fleetReportConfig: ReportConfig = {
    sections: [
      { id: 'resumo_frota', label: 'Resumo da frota' },
      { id: 'ranking_frota', label: 'Ranking dos cavalos' },
      { id: 'comparacao_periodo', label: 'Comparação com período anterior' },
      { id: 'historico_abastecimentos', label: 'Histórico de abastecimentos' },
    ],
    columnGroups: [
      {
        id: 'ranking',
        label: 'Ranking dos cavalos',
        sectionId: 'ranking_frota',
        columns: [
          { key: 'posicao', label: 'Posição' },
          { key: 'placa', label: 'Placa' },
          { key: 'abastecimentos', label: 'Abastecimentos' },
          { key: 'distancia', label: 'Distância' },
          { key: 'litros', label: 'Litros' },
          { key: 'media', label: 'Média atual' },
          { key: 'mediaAnterior', label: 'Média anterior' },
          { key: 'variacao', label: 'Variação' },
          { key: 'divergencias', label: 'Divergências' },
          { key: 'amostra', label: 'Amostra' },
        ],
      },
      {
        id: 'comparacao',
        label: 'Comparação com período anterior',
        sectionId: 'comparacao_periodo',
        columns: [
          { key: 'placa', label: 'Placa' },
          { key: 'mediaAtual', label: 'Média atual' },
          { key: 'mediaAnterior', label: 'Média anterior' },
          { key: 'variacao', label: 'Variação' },
        ],
      },
      {
        id: 'historico',
        label: 'Histórico de abastecimentos',
        sectionId: 'historico_abastecimentos',
        columns: [
          { key: 'data', label: 'Data' },
          { key: 'cavalo', label: 'Cavalo' },
          { key: 'kmAnterior', label: 'Km anterior' },
          { key: 'kmAtual', label: 'Km atual' },
          { key: 'distancia', label: 'Distância' },
          { key: 'litros', label: 'Litros' },
          { key: 'media', label: 'Média' },
          { key: 'status', label: 'Status' },
        ],
      },
    ],
};

const latestFleetReportConfig: ReportConfig = {
  sections: [{ id: 'ultimas_medias', label: 'Últimas médias da frota' }],
  columnGroups: [{
    id: 'ultimas_medias',
    label: 'Últimas médias da frota',
    sectionId: 'ultimas_medias',
    columns: [
      { key: 'placa', label: 'Placa' },
      { key: 'data', label: 'Data' },
      { key: 'kmAnterior', label: 'Km anterior' },
      { key: 'kmAtual', label: 'Km atual' },
      { key: 'distancia', label: 'Distância percorrida' },
      { key: 'litros', label: 'Litros' },
      { key: 'media', label: 'Última média' },
    ],
  }],
};

export const reportConfigs: Record<ReportType, ReportConfig> = {
  REGISTRO_GERAL: financialReportConfig,
  RELATORIO_COMBINADO: financialReportConfig,
  MEDIA_FROTA: fleetReportConfig,
  ULTIMAS_MEDIAS_FROTA: latestFleetReportConfig,
};

export const visibleReportTypes: Array<{ value: VisibleReportType; label: string }> = [
  { value: 'RELATORIO_COMBINADO', label: 'Relatório Financeiro' },
  { value: 'MEDIA_FROTA', label: 'Média da frota' },
  { value: 'ULTIMAS_MEDIAS_FROTA', label: 'Últimas médias da frota' },
];

export function normalizeReportType(reportType: ReportType): VisibleReportType {
  return reportType === 'REGISTRO_GERAL' ? 'RELATORIO_COMBINADO' : reportType;
}

export function reportFilterParams(filters: Record<string, string>, reportType: VisibleReportType) {
  const allowedFilters = reportType === 'MEDIA_FROTA'
    ? ['dataInicial', 'dataFinal', 'cavaloMecanicoId', 'placa']
    : reportType === 'ULTIMAS_MEDIAS_FROTA' ? ['cavaloMecanicoId', 'placa'] : null;
  const relevantFilters = Object.fromEntries(
    Object.entries(filters).filter(([name, value]) => value && (!allowedFilters || allowedFilters.includes(name))),
  );
  return { ...relevantFilters, tipoRelatorio: reportType };
}

export function reportFileName(reportType: VisibleReportType) {
  if (reportType === 'ULTIMAS_MEDIAS_FROTA') return 'relatorio-ultimas-medias-frota';
  return reportType === 'MEDIA_FROTA' ? 'relatorio-media-frota' : 'relatorio-financeiro';
}

export function migrateLegacyFinancialFilters(filters: Record<string, string>) {
  const migrated = { ...filters };
  for (const [legacyName, currentName] of Object.entries(legacyFinancialFilterNames)) {
    if (migrated[legacyName] && !migrated[currentName]) migrated[currentName] = migrated[legacyName];
    delete migrated[legacyName];
  }
  return migrated;
}

export function reportColumnId(groupId: string, columnKey: string) {
  return `${groupId}:${columnKey}`;
}

export function defaultReportSelection(reportType: ReportType): ReportSelection {
  const config = reportConfigs[reportType];
  return {
    sections: config.sections.map((section) => section.id),
    columns: config.columnGroups.flatMap((group) => group.columns.map((column) => reportColumnId(group.id, column.key))),
  };
}

export function validateReportSelection(reportType: ReportType, selection: ReportSelection) {
  const config = reportConfigs[reportType];
  if (!selection.sections.length) return 'Selecione pelo menos uma seção para gerar o relatório.';

  for (const group of config.columnGroups) {
    if (!selection.sections.includes(group.sectionId)) continue;
    const hasColumn = group.columns.some((column) => selection.columns.includes(reportColumnId(group.id, column.key)));
    if (!hasColumn) return `Selecione pelo menos uma coluna em “${group.label}”.`;
  }
  return '';
}

export function reportSelectionParams(selection: ReportSelection) {
  return {
    secoes: selection.sections.join(','),
    colunas: selection.columns.join(','),
  };
}

export function serializeReportFilterValue(value: string | string[]) {
  return Array.isArray(value) ? value.join(',') : value;
}

function reportSelectionStorageKey(reportType: ReportType, scope: string) {
  // A chave antiga é intencional: preferências já salvas continuam válidas.
  return `controle-transporte:pdf-options:v1:${scope}:${reportType}`;
}

function browserStorage(): ReportSelectionStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadReportSelection(
  reportType: ReportType,
  scope = 'default',
  storage: ReportSelectionStorage | null = browserStorage(),
): ReportSelection {
  const defaults = defaultReportSelection(reportType);
  if (!storage) return defaults;

  try {
    const stored = storage.getItem(reportSelectionStorageKey(reportType, scope))
      || (reportType === 'RELATORIO_COMBINADO'
        ? storage.getItem(reportSelectionStorageKey('REGISTRO_GERAL', scope))
        : null);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored) as Partial<ReportSelection> & { version?: number };
    if (!Array.isArray(parsed.sections) || !Array.isArray(parsed.columns)) return defaults;

    const config = reportConfigs[reportType];
    const validSections = new Set(config.sections.map((section) => section.id));
    const validColumns = new Set(
      config.columnGroups.flatMap((group) => group.columns.map((column) => reportColumnId(group.id, column.key))),
    );
    const selection = {
      sections: parsed.sections.filter((item): item is string => typeof item === 'string' && validSections.has(item)),
      columns: parsed.columns.filter((item): item is string => typeof item === 'string' && validColumns.has(item)),
    };
    if (parsed.sections.length > 0 && selection.sections.length === 0) return defaults;
    const migrated = migrateSelection(reportType, selection, parsed.version);
    return validateReportSelection(reportType, migrated) ? defaults : migrated;
  } catch {
    return defaults;
  }
}

export function saveReportSelection(
  reportType: ReportType,
  selection: ReportSelection,
  scope = 'default',
  storage: ReportSelectionStorage | null = browserStorage(),
) {
  if (!storage || validateReportSelection(reportType, selection)) return false;
  try {
    storage.setItem(reportSelectionStorageKey(reportType, scope), JSON.stringify({ ...selection, version: REPORT_PREFERENCE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

function lastReportStorageKey(scope: string) {
  return `controle-transporte:last-generated-report:v1:${scope}`;
}

export function loadLastGeneratedReport(
  scope = 'default',
  storage: ReportSelectionStorage | null = browserStorage(),
): LastGeneratedReport | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(lastReportStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<Partial<LastGeneratedReport>, 'reportType'> & {
      reportType?: ReportType;
      version?: number;
    };
    if (parsed.reportType !== 'REGISTRO_GERAL' && parsed.reportType !== 'RELATORIO_COMBINADO' && parsed.reportType !== 'MEDIA_FROTA' && parsed.reportType !== 'ULTIMAS_MEDIAS_FROTA') return null;
    if (!parsed.filters || typeof parsed.filters !== 'object' || Array.isArray(parsed.filters)) return null;
    if (!parsed.selection) return null;
    const reportType = normalizeReportType(parsed.reportType);
    const selection = migrateSelection(reportType, parsed.selection, parsed.version);
    if (validateReportSelection(reportType, selection)) return null;
    const filters = Object.fromEntries(
      Object.entries(parsed.filters).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
    return {
      reportType,
      filters: parsed.reportType === 'REGISTRO_GERAL' ? migrateLegacyFinancialFilters(filters) : filters,
      selection,
    };
  } catch {
    return null;
  }
}

export function saveLastGeneratedReport(
  report: LastGeneratedReport,
  scope = 'default',
  storage: ReportSelectionStorage | null = browserStorage(),
) {
  if (!storage || validateReportSelection(report.reportType, report.selection)) return false;
  try {
    storage.setItem(lastReportStorageKey(scope), JSON.stringify({ ...report, version: REPORT_PREFERENCE_VERSION }));
    return true;
  } catch {
    return false;
  }
}
