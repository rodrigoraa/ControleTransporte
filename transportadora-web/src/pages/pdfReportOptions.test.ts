import { describe, expect, it } from 'vitest';
import {
  defaultPdfSelection,
  pdfReportConfigs,
  pdfSelectionParams,
  validatePdfSelection,
} from './pdfReportOptions';

describe('opções do PDF', () => {
  it('inicia com todas as seções e colunas marcadas', () => {
    const selection = defaultPdfSelection('REGISTRO_GERAL');
    const config = pdfReportConfigs.REGISTRO_GERAL;

    expect(selection.sections).toHaveLength(config.sections.length);
    expect(selection.columns).toHaveLength(
      config.columnGroups.reduce((total, group) => total + group.columns.length, 0),
    );
  });

  it('exige uma seção e ao menos uma coluna nas tabelas selecionadas', () => {
    expect(validatePdfSelection('MEDIA_FROTA', { sections: [], columns: [] }))
      .toBe('Selecione pelo menos uma seção para gerar o PDF.');
    expect(validatePdfSelection('MEDIA_FROTA', {
      sections: ['historico_abastecimentos'],
      columns: [],
    })).toContain('Histórico de abastecimentos');
    expect(validatePdfSelection('MEDIA_FROTA', {
      sections: ['resumo_frota'],
      columns: [],
    })).toBe('');
  });

  it('serializa as escolhas para os parâmetros aceitos pela API', () => {
    expect(pdfSelectionParams({
      sections: ['lancamentos', 'comissoes'],
      columns: ['lancamentos:data', 'comissoes:liquida'],
    })).toEqual({
      secoesPdf: 'lancamentos,comissoes',
      colunasPdf: 'lancamentos:data,comissoes:liquida',
    });
  });
});
