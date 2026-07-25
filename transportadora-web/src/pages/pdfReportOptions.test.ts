import { describe, expect, it } from 'vitest';
import {
  defaultPdfSelection,
  loadPdfSelection,
  pdfReportConfigs,
  pdfSelectionParams,
  savePdfSelection,
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

  it('salva e recupera as preferências separadamente por usuário e tipo de relatório', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const generalSelection = {
      sections: ['resumo_financeiro', 'lancamentos'],
      columns: ['lancamentos:data', 'lancamentos:valorTotal'],
    };
    const fleetSelection = {
      sections: ['resumo_frota'],
      columns: [],
    };

    expect(savePdfSelection('REGISTRO_GERAL', generalSelection, 'user-1', storage)).toBe(true);
    expect(savePdfSelection('MEDIA_FROTA', fleetSelection, 'user-1', storage)).toBe(true);
    expect(loadPdfSelection('REGISTRO_GERAL', 'user-1', storage)).toEqual(generalSelection);
    expect(loadPdfSelection('MEDIA_FROTA', 'user-1', storage)).toEqual(fleetSelection);
    expect(loadPdfSelection('REGISTRO_GERAL', 'user-2', storage))
      .toEqual(defaultPdfSelection('REGISTRO_GERAL'));
  });

  it('ignora preferências inválidas e restaura a configuração padrão', () => {
    const storage = {
      getItem: () => '{"sections":["removida"],"columns":[]}',
      setItem: () => undefined,
    };

    expect(loadPdfSelection('REGISTRO_GERAL', 'user-1', storage))
      .toEqual(defaultPdfSelection('REGISTRO_GERAL'));
  });
});
