export type PdfReportType = 'REGISTRO_GERAL' | 'MEDIA_FROTA';

export type PdfSelection = {
  sections: string[];
  columns: string[];
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

export const pdfReportConfigs: Record<PdfReportType, PdfReportConfig> = {
  REGISTRO_GERAL: {
    sections: [
      { id: 'resumo_financeiro', label: 'Resumo financeiro' },
      { id: 'lancamentos', label: 'Lançamentos encontrados' },
      { id: 'grupos_cavalo', label: 'Resumo por cavalo mecânico' },
      { id: 'grupos_motorista', label: 'Resumo por motorista' },
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
          { key: 'motorista', label: 'Motorista' },
          { key: 'categoria', label: 'Categoria' },
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
  if (!selection.sections.length) return 'Selecione pelo menos uma seção para gerar o PDF.';

  for (const group of config.columnGroups) {
    if (!selection.sections.includes(group.sectionId)) continue;
    const hasColumn = group.columns.some((column) => selection.columns.includes(pdfColumnId(group.id, column.key)));
    if (!hasColumn) return `Selecione pelo menos uma coluna em “${group.label}”.`;
  }
  return '';
}

export function pdfSelectionParams(selection: PdfSelection) {
  return {
    secoesPdf: selection.sections.join(','),
    colunasPdf: selection.columns.join(','),
  };
}
