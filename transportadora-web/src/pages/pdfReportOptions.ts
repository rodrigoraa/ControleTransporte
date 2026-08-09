export type PdfReportType = 'REGISTRO_GERAL' | 'RELATORIO_COMBINADO' | 'MEDIA_FROTA';

export type PdfSelection = {
  sections: string[];
  columns: string[];
};

export type LastGeneratedReport = {
  reportType: PdfReportType;
  filters: Record<string, string>;
  selection: PdfSelection;
};

export type PdfColumnGroup = {
  id: string;
  label: string;
  sectionId: string;
  columns: Array<{ key: string; label: string }>;
};

export type PdfReportConfig = {
  sections: Array<{ id: string; label: string }>;
  columnGroups: PdfColumnGroup[];
};

type PdfSelectionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const REPORT_PREFERENCE_VERSION = 3;
const financialSummarySectionsV2 = ['grupos_clientes', 'grupos_fornecedores', 'grupos_categorias'];
const financialSummarySectionsV3 = ['grupos_placas', 'grupos_implementos', 'grupos_conjuntos', 'grupos_tipos_conjunto', 'grupos_eixos', 'grupos_tipos_financeiros'];

function migrateSelection(reportType: PdfReportType, selection: PdfSelection, version?: number): PdfSelection {
  if (version === REPORT_PREFERENCE_VERSION || reportType === 'MEDIA_FROTA') return selection;
  const sectionsToAdd = [
    ...(version === undefined || version < 2 ? financialSummarySectionsV2 : []),
    ...(version === undefined || version < 3 ? financialSummarySectionsV3 : []),
  ];
  return {
    ...selection,
    sections: [...new Set([...selection.sections, ...sectionsToAdd])],
  };
}

const basePdfReportConfigs: Record<Exclude<PdfReportType, 'RELATORIO_COMBINADO'>, PdfReportConfig> = {
  REGISTRO_GERAL: {
    sections: [
      { id: 'resumo_financeiro', label: 'Resumo financeiro' },
      { id: 'lancamentos', label: 'Lançamentos encontrados' },
      { id: 'grupos_cavalo', label: 'Resumo por cavalo mecânico' },
      { id: 'grupos_placas', label: 'Totais por placa registrada' },
      { id: 'grupos_motorista', label: 'Resumo por motorista' },
      { id: 'grupos_clientes', label: 'Totais por cliente' },
      { id: 'grupos_fornecedores', label: 'Totais por fornecedor' },
      { id: 'grupos_categorias', label: 'Totais por categoria financeira' },
      { id: 'grupos_implementos', label: 'Totais por implemento' },
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
  },
  MEDIA_FROTA: {
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
  },
};

export const pdfReportConfigs: Record<PdfReportType, PdfReportConfig> = {
  ...basePdfReportConfigs,
  RELATORIO_COMBINADO: basePdfReportConfigs.REGISTRO_GERAL,
};

export function pdfColumnId(groupId: string, columnKey: string) {
  return `${groupId}:${columnKey}`;
}

export function defaultPdfSelection(reportType: PdfReportType): PdfSelection {
  const config = pdfReportConfigs[reportType];
  return {
    sections: config.sections.map((section) => section.id),
    columns: config.columnGroups.flatMap((group) => group.columns.map((column) => pdfColumnId(group.id, column.key))),
  };
}

export function validatePdfSelection(reportType: PdfReportType, selection: PdfSelection) {
  const config = pdfReportConfigs[reportType];
  if (!selection.sections.length) return 'Selecione pelo menos uma seção para gerar o relatório.';

  for (const group of config.columnGroups) {
    if (!selection.sections.includes(group.sectionId)) continue;
    const hasColumn = group.columns.some((column) => selection.columns.includes(pdfColumnId(group.id, column.key)));
    if (!hasColumn) return `Selecione pelo menos uma coluna em “${group.label}”.`;
  }
  return '';
}

export const reportConfigs = pdfReportConfigs;
export const defaultReportSelection = defaultPdfSelection;
export const validateReportSelection = validatePdfSelection;
export const reportColumnId = pdfColumnId;
export const reportSelectionParams = pdfSelectionParams;

export function pdfSelectionParams(selection: PdfSelection) {
  return {
    secoesPdf: selection.sections.join(','),
    colunasPdf: selection.columns.join(','),
  };
}

function pdfSelectionStorageKey(reportType: PdfReportType, scope: string) {
  return `controle-transporte:pdf-options:v1:${scope}:${reportType}`;
}

function browserStorage(): PdfSelectionStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadPdfSelection(
  reportType: PdfReportType,
  scope = 'default',
  storage: PdfSelectionStorage | null = browserStorage(),
): PdfSelection {
  const defaults = defaultPdfSelection(reportType);
  if (!storage) return defaults;

  try {
    const stored = storage.getItem(pdfSelectionStorageKey(reportType, scope));
    if (!stored) return defaults;
    const parsed = JSON.parse(stored) as Partial<PdfSelection> & { version?: number };
    if (!Array.isArray(parsed.sections) || !Array.isArray(parsed.columns)) return defaults;

    const config = pdfReportConfigs[reportType];
    const validSections = new Set(config.sections.map((section) => section.id));
    const validColumns = new Set(
      config.columnGroups.flatMap((group) => group.columns.map((column) => pdfColumnId(group.id, column.key))),
    );
    const selection = {
      sections: parsed.sections.filter((item): item is string => typeof item === 'string' && validSections.has(item)),
      columns: parsed.columns.filter((item): item is string => typeof item === 'string' && validColumns.has(item)),
    };
    return validatePdfSelection(reportType, selection) ? defaults : migrateSelection(reportType, selection, parsed.version);
  } catch {
    return defaults;
  }
}

export function savePdfSelection(
  reportType: PdfReportType,
  selection: PdfSelection,
  scope = 'default',
  storage: PdfSelectionStorage | null = browserStorage(),
) {
  if (!storage || validatePdfSelection(reportType, selection)) return false;
  try {
    storage.setItem(pdfSelectionStorageKey(reportType, scope), JSON.stringify({ ...selection, version: REPORT_PREFERENCE_VERSION }));
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
  storage: PdfSelectionStorage | null = browserStorage(),
): LastGeneratedReport | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(lastReportStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastGeneratedReport> & { version?: number };
    if (parsed.reportType !== 'REGISTRO_GERAL' && parsed.reportType !== 'RELATORIO_COMBINADO' && parsed.reportType !== 'MEDIA_FROTA') return null;
    if (!parsed.filters || typeof parsed.filters !== 'object' || Array.isArray(parsed.filters)) return null;
    if (!parsed.selection || validatePdfSelection(parsed.reportType, parsed.selection)) return null;
    const selection = migrateSelection(parsed.reportType, parsed.selection, parsed.version);
    const filters = Object.fromEntries(
      Object.entries(parsed.filters).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
    return { reportType: parsed.reportType, filters, selection };
  } catch {
    return null;
  }
}

export function saveLastGeneratedReport(
  report: LastGeneratedReport,
  scope = 'default',
  storage: PdfSelectionStorage | null = browserStorage(),
) {
  if (!storage || validatePdfSelection(report.reportType, report.selection)) return false;
  try {
    storage.setItem(lastReportStorageKey(scope), JSON.stringify({ ...report, version: REPORT_PREFERENCE_VERSION }));
    return true;
  } catch {
    return false;
  }
}
