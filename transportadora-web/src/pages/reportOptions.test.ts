import { describe, expect, it } from 'vitest';
import {
  defaultReportSelection,
  loadReportSelection,
  loadLastGeneratedReport,
  migrateLegacyFinancialFilters,
  normalizeReportType,
  reportConfigs,
  reportFileName,
  reportFilterParams,
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
  it('disponibiliza o relatório financeiro, a média da frota e as últimas médias', () => {
    expect(visibleReportTypes).toEqual([
      { value: 'RELATORIO_COMBINADO', label: 'Relatório Financeiro' },
      { value: 'MEDIA_FROTA', label: 'Média da frota' },
      { value: 'ULTIMAS_MEDIAS_FROTA', label: 'Últimas médias da frota' },
    ]);
    expect(normalizeReportType('REGISTRO_GERAL')).toBe('RELATORIO_COMBINADO');
    expect(normalizeReportType('ULTIMAS_MEDIAS_FROTA')).toBe('ULTIMAS_MEDIAS_FROTA');
  });

  it('inicia últimas médias com a tabela e suas sete colunas', () => {
    expect(defaultReportSelection('ULTIMAS_MEDIAS_FROTA')).toEqual({
      sections: ['ultimas_medias'],
      columns: [
        'ultimas_medias:placa', 'ultimas_medias:data', 'ultimas_medias:kmAnterior',
        'ultimas_medias:kmAtual', 'ultimas_medias:distancia', 'ultimas_medias:litros', 'ultimas_medias:media',
      ],
    });
    expect(validateReportSelection('ULTIMAS_MEDIAS_FROTA', { sections: ['ultimas_medias'], columns: [] }))
      .toContain('Últimas médias da frota');
  });

  it('exclui datas e filtros financeiros das últimas médias e mantém os parâmetros dos relatórios anteriores', () => {
    const filters = {
      dataInicial: '2026-09-01', dataFinal: '2026-09-30', cavaloMecanicoId: 'cav-1',
      cavaloMecanicoIds: 'cav-1,cav-2', placa: 'QAV0D73', motoristaIds: 'mot-1',
      orderBy: 'data', orderDirection: 'desc', vazio: '',
    };

    expect(reportFilterParams(filters, 'ULTIMAS_MEDIAS_FROTA')).toEqual({
      tipoRelatorio: 'ULTIMAS_MEDIAS_FROTA', cavaloMecanicoId: 'cav-1', placa: 'QAV0D73',
    });
    expect(reportFilterParams(filters, 'MEDIA_FROTA')).toEqual({
      tipoRelatorio: 'MEDIA_FROTA', dataInicial: '2026-09-01', dataFinal: '2026-09-30',
      cavaloMecanicoId: 'cav-1', placa: 'QAV0D73',
    });
    const { vazio: _vazio, ...filledFilters } = filters;
    expect(reportFilterParams(filters, 'RELATORIO_COMBINADO')).toEqual({ ...filledFilters, tipoRelatorio: 'RELATORIO_COMBINADO' });
  });

  it('identifica os arquivos exportados de cada tipo de relatório', () => {
    expect(reportFileName('ULTIMAS_MEDIAS_FROTA')).toBe('relatorio-ultimas-medias-frota');
    expect(reportFileName('MEDIA_FROTA')).toBe('relatorio-media-frota');
    expect(reportFileName('RELATORIO_COMBINADO')).toBe('relatorio-financeiro');
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

  it('salva e restaura últimas médias por usuário sem alterar as preferências dos relatórios existentes', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const selection = { sections: ['ultimas_medias'], columns: ['ultimas_medias:placa', 'ultimas_medias:media'] };
    const report = { reportType: 'ULTIMAS_MEDIAS_FROTA' as const, filters: { placa: 'QAV0D73' }, selection };
    const financialSelection = { sections: ['resumo_financeiro'], columns: [] };

    expect(saveReportSelection('RELATORIO_COMBINADO', financialSelection, 'user-1', storage)).toBe(true);
    expect(saveReportSelection('ULTIMAS_MEDIAS_FROTA', selection, 'user-1', storage)).toBe(true);
    expect(loadReportSelection('ULTIMAS_MEDIAS_FROTA', 'user-1', storage)).toEqual(selection);
    expect(loadReportSelection('ULTIMAS_MEDIAS_FROTA', 'user-2', storage)).toEqual(defaultReportSelection('ULTIMAS_MEDIAS_FROTA'));
    expect(loadReportSelection('RELATORIO_COMBINADO', 'user-1', storage)).toEqual(financialSelection);
    expect(saveLastGeneratedReport(report, 'user-1', storage)).toBe(true);
    expect(loadLastGeneratedReport('user-1', storage)).toEqual(report);
    expect(loadLastGeneratedReport('user-2', storage)).toBeNull();
  });

  it('não adiciona seções financeiras a preferências de últimas médias sem versão', () => {
    const selection = { sections: ['ultimas_medias'], columns: ['ultimas_medias:placa', 'ultimas_medias:media'] };
    const report = { reportType: 'ULTIMAS_MEDIAS_FROTA' as const, filters: {}, selection };
    const storage = {
      getItem: (key: string) => JSON.stringify(key.includes('last-generated-report') ? report : selection),
      setItem: () => undefined,
    };

    expect(loadReportSelection('ULTIMAS_MEDIAS_FROTA', 'user-1', storage)).toEqual(selection);
    expect(loadLastGeneratedReport('user-1', storage)).toEqual(report);
  });
});
