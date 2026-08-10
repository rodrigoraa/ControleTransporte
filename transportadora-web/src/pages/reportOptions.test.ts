import { describe, expect, it } from 'vitest';
import {
  defaultReportSelection,
  loadReportSelection,
  loadLastGeneratedReport,
  migrateLegacyFinancialFilters,
  normalizeReportType,
  reportConfigs,
  reportSelectionParams,
  saveReportSelection,
  saveLastGeneratedReport,
  serializeReportFilterValue,
  validateReportSelection,
  visibleReportTypes,
} from './reportOptions';

describe('seleção de conteúdo dos relatórios', () => {
  it('serializa filtros múltiplos no formato compatível com a API', () => {
    expect(serializeReportFilterValue(['cav-1', 'cav-2'])).toBe('cav-1,cav-2');
    expect(serializeReportFilterValue('cav-1')).toBe('cav-1');
  });
  it('usa a mesma configuração financeira interna nos dois modos de UX', () => {
    expect(reportConfigs.RELATORIO_COMBINADO).toBe(reportConfigs.REGISTRO_GERAL);
  });
  it('exibe apenas o relatório financeiro e a média da frota', () => {
    expect(visibleReportTypes).toEqual([
      { value: 'RELATORIO_COMBINADO', label: 'Relatório Financeiro' },
      { value: 'MEDIA_FROTA', label: 'Média da frota' },
    ]);
    expect(normalizeReportType('REGISTRO_GERAL')).toBe('RELATORIO_COMBINADO');
  });
  it('inicia com todas as seções e colunas marcadas', () => {
    const selection = defaultReportSelection('REGISTRO_GERAL');
    const config = reportConfigs.REGISTRO_GERAL;

    expect(selection.sections).toHaveLength(config.sections.length);
    expect(selection.columns).toHaveLength(
      config.columnGroups.reduce((total, group) => total + group.columns.length, 0),
    );
  });

  it('exige uma seção e ao menos uma coluna nas tabelas selecionadas', () => {
    expect(validateReportSelection('MEDIA_FROTA', { sections: [], columns: [] }))
      .toBe('Selecione pelo menos uma seção para gerar o relatório.');
    expect(validateReportSelection('MEDIA_FROTA', {
      sections: ['historico_abastecimentos'],
      columns: [],
    })).toContain('Histórico de abastecimentos');
    expect(validateReportSelection('MEDIA_FROTA', {
      sections: ['resumo_frota'],
      columns: [],
    })).toBe('');
  });

  it('serializa as escolhas para os parâmetros aceitos pela API', () => {
    expect(reportSelectionParams({
      sections: ['lancamentos', 'comissoes'],
      columns: ['lancamentos:data', 'comissoes:liquida'],
    })).toEqual({
      secoes: 'lancamentos,comissoes',
      colunas: 'lancamentos:data,comissoes:liquida',
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

    expect(saveReportSelection('REGISTRO_GERAL', generalSelection, 'user-1', storage)).toBe(true);
    expect(saveReportSelection('MEDIA_FROTA', fleetSelection, 'user-1', storage)).toBe(true);
    expect(loadReportSelection('REGISTRO_GERAL', 'user-1', storage)).toEqual(generalSelection);
    expect(loadReportSelection('MEDIA_FROTA', 'user-1', storage)).toEqual(fleetSelection);
    expect(loadReportSelection('REGISTRO_GERAL', 'user-2', storage))
      .toEqual(defaultReportSelection('REGISTRO_GERAL'));
  });

  it('migra preferências da chave histórica de opções do PDF', () => {
    const values = new Map<string, string>([[
      'controle-transporte:pdf-options:v1:user-legacy:REGISTRO_GERAL',
      JSON.stringify({
        version: 3,
        sections: ['resumo_financeiro', 'lancamentos'],
        columns: ['lancamentos:data', 'lancamentos:valorTotal'],
      }),
    ]]);
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    expect(loadReportSelection('REGISTRO_GERAL', 'user-legacy', storage)).toEqual({
      sections: ['resumo_financeiro', 'lancamentos'],
      columns: ['lancamentos:data', 'lancamentos:valorTotal'],
    });
  });

  it('usa as preferências do Registro Geral como fallback do Relatório Financeiro', () => {
    const values = new Map<string, string>([[
      'controle-transporte:pdf-options:v1:user-legacy:REGISTRO_GERAL',
      JSON.stringify({
        version: 3,
        sections: ['resumo_financeiro', 'lancamentos'],
        columns: ['lancamentos:data', 'lancamentos:valorTotal'],
      }),
    ]]);
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    expect(loadReportSelection('RELATORIO_COMBINADO', 'user-legacy', storage)).toEqual({
      sections: ['resumo_financeiro', 'lancamentos'],
      columns: ['lancamentos:data', 'lancamentos:valorTotal'],
    });
  });

  it('converte os filtros singulares antigos para os filtros múltiplos', () => {
    expect(migrateLegacyFinancialFilters({
      dataInicial: '2026-01-01',
      cavaloMecanicoId: 'cav-1',
      motoristaId: 'mot-1',
      tipoLancamento: 'DESPESA',
    })).toEqual({
      dataInicial: '2026-01-01',
      cavaloMecanicoIds: 'cav-1',
      motoristaIds: 'mot-1',
      tiposLancamento: 'DESPESA',
    });
  });

  it('ignora preferências inválidas e restaura a configuração padrão', () => {
    const storage = {
      getItem: () => '{"sections":["removida"],"columns":[]}',
      setItem: () => undefined,
    };

    expect(loadReportSelection('REGISTRO_GERAL', 'user-1', storage))
      .toEqual(defaultReportSelection('REGISTRO_GERAL'));
  });

  it('inclui os novos resumos financeiros nas preferências salvas anteriormente', () => {
    const storage = {
      getItem: () => JSON.stringify({
        sections: ['resumo_financeiro', 'lancamentos'],
        columns: ['lancamentos:data'],
      }),
      setItem: () => undefined,
    };

    const selection = loadReportSelection('REGISTRO_GERAL', 'user-1', storage);

    expect(selection.sections).toEqual(expect.arrayContaining([
      'grupos_clientes',
      'grupos_fornecedores',
      'grupos_categorias',
      'grupos_placas',
      'grupos_implementos',
      'grupos_conjuntos',
      'grupos_tipos_conjunto',
      'grupos_eixos',
      'grupos_tipos_financeiros',
    ]));
  });

  it('guarda os filtros e o conteúdo da última geração por usuário', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const report = {
      reportType: 'RELATORIO_COMBINADO' as const,
      filters: { cavaloMecanicoIds: 'cav-1,cav-2', motoristaIds: 'mot-1' },
      selection: {
        sections: ['resumo_financeiro', 'lancamentos'],
        columns: ['lancamentos:data', 'lancamentos:cavalo'],
      },
    };

    expect(saveLastGeneratedReport(report, 'user-1', storage)).toBe(true);
    expect(loadLastGeneratedReport('user-1', storage)).toEqual(report);
    expect(loadLastGeneratedReport('user-2', storage)).toBeNull();
  });

  it('restaura a última geração legada como Relatório Financeiro', () => {
    const values = new Map<string, string>([[
      'controle-transporte:last-generated-report:v1:user-legacy',
      JSON.stringify({
        version: 3,
        reportType: 'REGISTRO_GERAL',
        filters: { cavaloMecanicoId: 'cav-1', categoriaId: 'cat-1' },
        selection: {
          sections: ['resumo_financeiro', 'lancamentos'],
          columns: ['lancamentos:data'],
        },
      }),
    ]]);
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    expect(loadLastGeneratedReport('user-legacy', storage)).toEqual({
      reportType: 'RELATORIO_COMBINADO',
      filters: { cavaloMecanicoIds: 'cav-1', categoriaIds: 'cat-1' },
      selection: {
        sections: ['resumo_financeiro', 'lancamentos'],
        columns: ['lancamentos:data'],
      },
    });
  });
});
