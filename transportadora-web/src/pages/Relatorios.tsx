import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Download, FileSpreadsheet, Filter, RotateCcw, Search } from 'lucide-react';
import { api } from '../services/api';
import { MultiSearchableSelect, SearchableSelect } from '../components/SearchableSelect';
import { useAuth } from '../contexts/AuthContext';
import { apiErrorMessage } from '../utils/apiError';
import { date, money } from '../utils/formatters';
import { nextTableSort, sortTableRows, TableSort } from '../utils/tableSorting';
import {
  defaultReportSelection,
  loadLastGeneratedReport,
  loadReportSelection,
  reportColumnId,
  reportConfigs,
  reportSelectionParams,
  ReportSelection,
  VisibleReportType,
  saveReportSelection,
  saveLastGeneratedReport,
  serializeReportFilterValue,
  validateReportSelection,
  visibleReportTypes,
} from './reportOptions';

type Option = { value: string; label: string; cavaloMecanicoId?: string | null; tipo?: string; quantidadeTotalEixos?: number };
type ReportOptions = {
  motoristas: Option[];
  cavalosMecanicos: Option[];
  implementos: Option[];
  conjuntos: Option[];
  fornecedores: Option[];
  clientes: Option[];
  categorias: Option[];
  tipos: Option[];
  tiposConjunto: Option[];
  quantidadesEixos: Option[];
};
const filterFieldsByReport: Record<VisibleReportType, string[]> = {
  RELATORIO_COMBINADO: ['dataInicial', 'dataFinal', 'cavaloMecanicoIds', 'placa', 'motoristaIds', 'implementoIds', 'conjuntoIds', 'tiposConjunto', 'quantidadesEixos', 'fornecedorIds', 'clienteIds', 'tiposLancamento', 'categoriaIds'],
  MEDIA_FROTA: ['dataInicial', 'dataFinal', 'cavaloMecanicoId', 'placa'],
};

export function Relatorios() {
  const { user } = useAuth();
  const preferenceScope = user?.id || 'anonymous';
  const [restoredReport] = useState(() => loadLastGeneratedReport(preferenceScope));
  const [reportType, setReportType] = useState<VisibleReportType>(restoredReport?.reportType || 'RELATORIO_COMBINADO');
  const [filters, setFilters] = useState<Record<string, string>>(restoredReport?.filters || {});
  const [reportSelection, setReportSelection] = useState<ReportSelection>(
    restoredReport?.selection || loadReportSelection(restoredReport?.reportType || 'RELATORIO_COMBINADO', preferenceScope),
  );
  const [generatedReport, setGeneratedReport] = useState<{
    reportType: VisibleReportType;
    filters: Record<string, string>;
    selection: ReportSelection;
  } | null>(null);
  const [financeiro, setFinanceiro] = useState<any>(null);
  const [, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [options, setOptions] = useState<ReportOptions>({
    motoristas: [],
    cavalosMecanicos: [],
    implementos: [],
    conjuntos: [],
    fornecedores: [],
    clientes: [],
    categorias: [],
    tipos: [],
    tiposConjunto: [],
    quantidadesEixos: [],
  });
  const activeFilters = filterFieldsByReport[reportType].filter((name) => Boolean(filters[name])).length;
  const hasFiltersToClear = Object.entries(filters).some(([name, value]) => value && !['orderBy', 'orderDirection'].includes(name));
  const reportSort: TableSort = {
    orderBy: generatedReport?.filters.orderBy || '',
    orderDirection: generatedReport?.filters.orderDirection === 'asc' ? 'asc' : 'desc',
  };

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setOptionsLoading(true);
      try {
        const response = await api.get('/relatorios/opcoes', {
          params: reportParams(filters, reportType),
          signal: controller.signal,
        });
        setOptions(response.data);
      } catch (requestError: any) {
        if (requestError?.code !== 'ERR_CANCELED') {
          setError(await apiErrorMessage(requestError, 'Não foi possível atualizar as opções dos filtros.'));
        }
      } finally {
        if (!controller.signal.aborted) setOptionsLoading(false);
      }
    }, 200);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [filters, reportType]);

  function updateFilter(name: string, value: string | string[]) {
    const serializedValue = serializeReportFilterValue(value);
    const next = { ...filters, [name]: serializedValue };
    setPage(1);
    setFilters(next);
  }

  function clearFilters() {
    setFilters(Object.fromEntries(
      Object.entries(filters).filter(([name, value]) => value && ['orderBy', 'orderDirection'].includes(name)),
    ));
    setPage(1);
    setError('');
  }

  function reportParams(sourceFilters = filters, sourceType = reportType) {
    const relevantFilters = sourceType === 'MEDIA_FROTA'
      ? Object.fromEntries(Object.entries(sourceFilters).filter(([name, value]) => value && ['dataInicial', 'dataFinal', 'cavaloMecanicoId', 'placa'].includes(name)))
      : Object.fromEntries(Object.entries(sourceFilters).filter(([, value]) => value));
    return { ...relevantFilters, tipoRelatorio: sourceType };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateReportSelection(reportType, reportSelection);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPage(1);
    await loadReport(1, filters, reportSelection, reportType, true);
  }

  async function loadReport(
    targetPage: number,
    sourceFilters: Record<string, string>,
    sourceSelection: ReportSelection,
    sourceType: VisibleReportType,
    persist = false,
  ) {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/relatorios/financeiros', {
        params: { ...reportParams(sourceFilters, sourceType), ...reportSelectionParams(sourceSelection), page: targetPage, limit: 50 },
      });
      setPage(targetPage);
      setFinanceiro(data);
      const snapshot = { reportType: sourceType, filters: sourceFilters, selection: sourceSelection };
      setGeneratedReport(snapshot);
      if (persist) {
        saveReportSelection(sourceType, sourceSelection, preferenceScope);
        saveLastGeneratedReport(snapshot, preferenceScope);
      }
    } catch (requestError: any) {
      setError(await apiErrorMessage(requestError, 'Não foi possível gerar o relatório.'));
    } finally {
      setLoading(false);
    }
  }

  async function exportReport(format: 'csv' | 'pdf') {
    if (!generatedReport) return false;
    setError('');
    try {
      const { data } = await api.get(`/relatorios/financeiros/exportar.${format}`, {
        params: {
          ...reportParams(generatedReport.filters, generatedReport.reportType),
          ...reportSelectionParams(generatedReport.selection),
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      const reportName = generatedReport.reportType === 'MEDIA_FROTA'
        ? 'relatorio-media-frota'
        : 'relatorio-financeiro';
      link.download = `${reportName}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (requestError: any) {
      setError(await apiErrorMessage(requestError, `Não foi possível exportar o relatório em ${format.toUpperCase()}.`));
      return false;
    }
  }

  async function changeReportSort(orderBy: string) {
    if (!generatedReport) return;
    const currentSort: TableSort = {
      orderBy: generatedReport.filters.orderBy || '',
      orderDirection: generatedReport.filters.orderDirection === 'asc' ? 'asc' : 'desc',
    };
    const nextSort = nextTableSort(currentSort, orderBy);
    const nextFilters = { ...generatedReport.filters, ...nextSort };
    setFilters(nextFilters);
    setPage(1);
    await loadReport(1, nextFilters, generatedReport.selection, generatedReport.reportType, true);
  }

  async function changePage(targetPage: number) {
    if (!generatedReport) return;
    await loadReport(targetPage, generatedReport.filters, generatedReport.selection, generatedReport.reportType);
  }

  return (
    <section className="page">
      <div className="page-header report-header">
        <div>
          <h1>Relatórios</h1>
          <p>{reportType === 'MEDIA_FROTA'
            ? 'Média ponderada de consumo, ranking e comparação por cavalo mecânico.'
            : 'Lançamentos, indicadores financeiros e comissões com filtros simples ou múltiplos.'}</p>
        </div>
        {financeiro && (
          <div className="actions">
            <button className="button" type="button" onClick={() => exportReport('csv')}>
              <FileSpreadsheet size={18} />
              CSV
            </button>
            <button className="button primary" type="button" onClick={() => exportReport('pdf')}>
              <Download size={18} />
              PDF
            </button>
          </div>
        )}
      </div>

      <form className="panel report-filters report-filter-panel" onSubmit={submit}>
        <div className="filter-heading wide">
          <div>
            <span><Filter size={16} /> Filtros</span>
            <strong>{activeFilters ? `${activeFilters} ${activeFilters === 1 ? 'filtro ativo' : 'filtros ativos'}` : 'Visão geral'}</strong>
          </div>
          <div className="filter-heading-actions">
            <button className="button ghost" type="button" disabled={loading || !hasFiltersToClear} onClick={clearFilters}>
              <RotateCcw size={17} />
              Limpar filtros
            </button>
            <button className="button primary" disabled={loading}>
              <Search size={18} />
              {loading ? 'Gerando...' : 'Gerar relatório'}
            </button>
          </div>
        </div>
        <SelectFilter
          label="Tipo de relatório"
          name="tipoRelatorio"
          value={reportType}
          options={visibleReportTypes}
          onChange={(_, value) => {
            const nextType: VisibleReportType = value === 'MEDIA_FROTA' ? 'MEDIA_FROTA' : 'RELATORIO_COMBINADO';
            setReportType(nextType);
            setReportSelection(loadReportSelection(nextType, preferenceScope));
            setFilters({});
            setFinanceiro(null);
            setGeneratedReport(null);
            setPage(1);
            setError('');
          }}
        />
        <label>Data inicial<input type="date" value={filters.dataInicial || ''} onChange={(e) => updateFilter('dataInicial', e.target.value)} /></label>
        <label>Data final<input type="date" value={filters.dataFinal || ''} onChange={(e) => updateFilter('dataFinal', e.target.value)} /></label>
        {reportType === 'MEDIA_FROTA'
          ? <SelectFilter label="Cavalo mecânico" name="cavaloMecanicoId" value={filters.cavaloMecanicoId || ''} options={options.cavalosMecanicos} disabled={optionsLoading} onChange={updateFilter} />
          : <MultiSelectFilter label="Cavalos mecânicos / placas" name="cavaloMecanicoIds" value={filterArray(filters.cavaloMecanicoIds)} options={options.cavalosMecanicos} disabled={optionsLoading} onChange={updateFilter} />}
        <label>
          Placa gravada no registro
          <input
            type="text"
            maxLength={128}
            placeholder="Filtro avançado do snapshot histórico"
            value={filters.placa || ''}
            onChange={(event) => updateFilter('placa', event.target.value.toUpperCase())}
          />
        </label>
        {reportType !== 'MEDIA_FROTA' && (
          <>
            <MultiSelectFilter label="Motoristas" name="motoristaIds" value={filterArray(filters.motoristaIds)} options={options.motoristas} disabled={optionsLoading} onChange={updateFilter} />
            <MultiSelectFilter label="Implementos" name="implementoIds" value={filterArray(filters.implementoIds)} options={options.implementos} disabled={optionsLoading} onChange={updateFilter} />
            <MultiSelectFilter label="Conjuntos operacionais" name="conjuntoIds" value={filterArray(filters.conjuntoIds)} options={options.conjuntos} disabled={optionsLoading} onChange={updateFilter} />
            <MultiSelectFilter label="Tipos de conjunto" name="tiposConjunto" value={filterArray(filters.tiposConjunto)} options={options.tiposConjunto} disabled={optionsLoading} onChange={updateFilter} />
            <MultiSelectFilter label="Quantidades de eixos" name="quantidadesEixos" value={filterArray(filters.quantidadesEixos)} options={options.quantidadesEixos} disabled={optionsLoading} onChange={updateFilter} />
            <MultiSelectFilter label="Fornecedores" name="fornecedorIds" value={filterArray(filters.fornecedorIds)} options={options.fornecedores} disabled={optionsLoading} onChange={updateFilter} />
            <MultiSelectFilter label="Clientes" name="clienteIds" value={filterArray(filters.clienteIds)} options={options.clientes} disabled={optionsLoading} onChange={updateFilter} />
            <MultiSelectFilter label="Tipos financeiros" name="tiposLancamento" value={filterArray(filters.tiposLancamento)} options={options.tipos} disabled={optionsLoading} onChange={updateFilter} />
            <MultiSelectFilter label="Categorias" name="categoriaIds" value={filterArray(filters.categoriaIds)} options={options.categorias} disabled={optionsLoading} onChange={updateFilter} />
            <SelectFilter
              label="Ordenar por"
              name="orderBy"
              value={filters.orderBy || ''}
              options={[
                { value: 'data', label: 'Data' },
                { value: 'tipoLancamento', label: 'Tipo' },
                { value: 'cavalo', label: 'Cavalo' },
                { value: 'conjunto', label: 'Conjunto' },
                { value: 'motorista', label: 'Motorista' },
                { value: 'parte', label: 'Fornecedor/Cliente' },
                { value: 'categoria', label: 'Categoria' },
                { value: 'quantidade', label: 'Quantidade' },
                { value: 'valorUnitario', label: 'Valor unitário' },
                { value: 'valorTotal', label: 'Valor total' },
              ]}
              onChange={updateFilter}
            />
            <SelectFilter label="Direção" name="orderDirection" value={filters.orderDirection || ''} options={[{ value: 'desc', label: 'Decrescente' }, { value: 'asc', label: 'Crescente' }]} onChange={updateFilter} />
          </>
        )}
        <ReportCustomization
          reportType={reportType}
          selection={reportSelection}
          onChange={(selection) => {
            setReportSelection(selection);
            setError('');
          }}
        />
      </form>

      {error && <div className="form-error">{error}</div>}
      {financeiro && (
        generatedReport?.reportType === 'MEDIA_FROTA' ? (
          <ConsumoReport consumo={financeiro.consumo} selection={generatedReport.selection} />
        ) : (
        <>
          {generatedReport?.selection.sections.includes('resumo_financeiro') && <div className="stats-grid">
            <article className="stat-card stat-danger"><span>Total de despesas</span><strong>{money(financeiro.totalDespesas)}</strong></article>
            <article className="stat-card stat-success"><span>Total de faturamento</span><strong>{money(financeiro.totalFaturamento)}</strong></article>
            <article className={`stat-card ${financeiro.saldoFinal >= 0 ? 'stat-info' : 'stat-danger'}`}><span>Saldo final</span><strong>{money(financeiro.saldoFinal)}</strong></article>
            <article className="stat-card stat-neutral"><span>Lançamentos</span><strong>{financeiro.total}</strong></article>
          </div>}

          {generatedReport?.selection.sections.includes('comissoes') && <CommissionReport comissoes={financeiro.comissoes} selection={generatedReport.selection} />}

          {generatedReport?.selection.sections.includes('lancamentos') && <div className="panel report-table-panel">
            <div className="panel-title-row">
              <div>
                <h2>Lançamentos encontrados</h2>
                <p>Detalhamento das despesas e faturamentos, incluindo a composição registrada no momento do lançamento.</p>
              </div>
              <div className="actions">
                <button className="button" type="button" onClick={() => exportReport('csv')}>
                  <FileSpreadsheet size={18} />
                  Exportar CSV
                </button>
                <button className="button" type="button" onClick={() => exportReport('pdf')}>
                  <Download size={18} />
                  Exportar PDF
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'data') && <SortableHeader label="Data" sortKey="data" sort={reportSort} onSort={changeReportSort} />}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'tipo') && <SortableHeader label="Tipo" sortKey="tipoLancamento" sort={reportSort} onSort={changeReportSort} />}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'cavalo') && <SortableHeader label="Cavalo" sortKey="cavalo" sort={reportSort} onSort={changeReportSort} />}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'conjunto') && <SortableHeader label="Conjunto registrado" sortKey="conjunto" sort={reportSort} onSort={changeReportSort} />}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'implementos') && <th>Implementos usados no lançamento</th>}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'motorista') && <SortableHeader label="Motorista" sortKey="motorista" sort={reportSort} onSort={changeReportSort} />}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'parte') && <SortableHeader label="Fornecedor/Cliente" sortKey="parte" sort={reportSort} onSort={changeReportSort} />}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'categoria') && <SortableHeader label="Categoria" sortKey="categoria" sort={reportSort} onSort={changeReportSort} />}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'quantidade') && <SortableHeader label="Qtd." sortKey="quantidade" sort={reportSort} onSort={changeReportSort} />}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'valorUnitario') && <SortableHeader label="Valor unitário" sortKey="valorUnitario" sort={reportSort} onSort={changeReportSort} />}
                    {hasColumn(generatedReport?.selection, 'lancamentos', 'valorTotal') && <SortableHeader label="Valor total" sortKey="valorTotal" sort={reportSort} onSort={changeReportSort} />}
                  </tr>
                </thead>
                <tbody>
                  {!financeiro.historico.length && (
                    <tr><td colSpan={selectedColumnCount(generatedReport?.selection, 'lancamentos')}>Nenhum lançamento encontrado para os filtros informados.</td></tr>
                  )}
                  {financeiro.historico.map((item: any) => (
                    <tr key={item.id}>
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'data') && <td>{date(item.data)}</td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'tipo') && <td><TipoBadge tipo={item.tipoLancamento} /></td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'cavalo') && <td>{item.cavaloMecanico?.placa || item.placa}</td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'conjunto') && <td>{labelConjunto(item.conjunto)}</td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'implementos') && <td>{labelImplementos(item.conjunto)}</td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'motorista') && <td>{labelPessoa(item.motorista)}</td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'parte') && <td>{labelPessoa(item.fornecedor) !== '-' ? labelPessoa(item.fornecedor) : labelPessoa(item.cliente)}</td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'categoria') && <td>{item.categoriaFinanceira?.nome || '-'}</td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'quantidade') && <td>{Number(item.quantidade).toLocaleString('pt-BR')} {item.unidadeQuantidade}</td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'valorUnitario') && <td className="money-cell">{money(item.valorUnitario)}</td>}
                      {hasColumn(generatedReport?.selection, 'lancamentos', 'valorTotal') && <td className={`money-cell ${item.tipoLancamento === 'DESPESA' ? 'negative' : 'positive'}`}>{money(item.valorTotal)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>{financeiro.total} lançamentos</span>
              <button className="button" type="button" disabled={financeiro.page === 1 || loading} onClick={() => changePage(financeiro.page - 1)}>Anterior</button>
              <strong>{financeiro.page}</strong>
              <button className="button" type="button" disabled={financeiro.page * financeiro.limit >= financeiro.total || loading} onClick={() => changePage(financeiro.page + 1)}>Próxima</button>
            </div>
          </div>}

          {generatedReport?.selection.sections.includes('grupos_cavalo') && <TotalsByDimension
            title="Totais por cavalo mecânico atualmente relacionado"
            description="Despesas e faturamentos separados para cada placa encontrada."
            expenseTitle="Despesas por placa"
            revenueTitle="Faturamento por placa"
            expenses={financeiro.despesasPorCavaloMecanico}
            revenues={financeiro.faturamentoPorCavaloMecanico}
          />}
          {generatedReport?.selection.sections.includes('grupos_placas') && <TotalsByDimension
            title="Placa registrada no lançamento (snapshot histórico)"
            description="Valores agrupados pelo texto da placa gravado em cada lançamento."
            expenseTitle="Despesas por placa registrada"
            revenueTitle="Faturamento por placa registrada"
            expenses={financeiro.despesasPorPlaca}
            revenues={financeiro.faturamentoPorPlaca}
          />}
          {generatedReport?.selection.sections.includes('grupos_clientes') && <TotalsByDimension
            title="Faturamento por cliente"
            description="Valores financeiros consolidados individualmente por cliente."
            revenueTitle="Faturamento por cliente"
            revenues={financeiro.faturamentoPorCliente}
          />}
          {generatedReport?.selection.sections.includes('grupos_fornecedores') && <TotalsByDimension
            title="Despesas por fornecedor"
            description="Valores financeiros consolidados individualmente por fornecedor."
            expenseTitle="Despesas por fornecedor"
            expenses={financeiro.despesasPorFornecedor}
          />}
          {generatedReport?.selection.sections.includes('grupos_categorias') && <TotalsByDimension
            title="Totais por categoria financeira"
            description="Despesas e faturamentos separados conforme a categoria financeira."
            expenseTitle="Despesas por categoria"
            revenueTitle="Faturamento por categoria"
            expenses={financeiro.despesasPorCategoria}
            revenues={financeiro.faturamentoPorCategoria}
          />}
          {generatedReport?.selection.sections.includes('grupos_implementos') && <TotalsByDimension
            title="Valores relacionados a implementos (não somáveis)"
            description="Valores associados diretamente ao implemento ou ao conjunto operacional do qual ele participa."
            expenseTitle="Despesas relacionadas"
            revenueTitle="Faturamentos relacionados"
            expenses={financeiro.despesasPorImplemento}
            revenues={financeiro.faturamentoPorImplemento}
          />}
          {generatedReport?.selection.sections.includes('grupos_conjuntos') && <TotalsByDimension
            title="Totais por conjunto operacional"
            description="Despesas e faturamentos consolidados para cada conjunto utilizado."
            expenseTitle="Despesas por conjunto"
            revenueTitle="Faturamento por conjunto"
            expenses={financeiro.despesasPorConjunto}
            revenues={financeiro.faturamentoPorConjunto}
          />}
          {generatedReport?.selection.sections.includes('grupos_tipos_conjunto') && <TotalsByDimension
            title="Totais por tipo de conjunto"
            description="Valores consolidados por Simples, Bitrem, Rodotrem ou Outro."
            expenseTitle="Despesas por tipo de conjunto"
            revenueTitle="Faturamento por tipo de conjunto"
            expenses={financeiro.despesasPorTipoConjunto}
            revenues={financeiro.faturamentoPorTipoConjunto}
          />}
          {generatedReport?.selection.sections.includes('grupos_eixos') && <TotalsByDimension
            title="Totais por quantidade de eixos"
            description="Valores consolidados conforme a quantidade total de eixos do conjunto."
            expenseTitle="Despesas por quantidade de eixos"
            revenueTitle="Faturamento por quantidade de eixos"
            expenses={financeiro.despesasPorQuantidadeEixos}
            revenues={financeiro.faturamentoPorQuantidadeEixos}
          />}
          {generatedReport?.selection.sections.includes('grupos_tipos_financeiros') && <TotalsByDimension
            title="Totais por tipo financeiro"
            description="Separação direta entre o valor total das despesas e dos faturamentos."
            expenseTitle="Total de despesas"
            revenueTitle="Total de faturamento"
            expenses={[{ id: 'DESPESA', label: 'Despesas', total: financeiro.totalDespesas }]}
            revenues={[{ id: 'FATURAMENTO', label: 'Faturamento', total: financeiro.totalFaturamento }]}
          />}
          {generatedReport?.selection.sections.includes('grupos_motorista') && <TotalsByDimension
            title="Totais por motorista"
            description="Despesas e faturamentos consolidados individualmente por motorista."
            expenseTitle="Despesas por motorista"
            revenueTitle="Faturamento por motorista"
            expenses={financeiro.despesasPorMotorista}
            revenues={financeiro.faturamentoPorMotorista}
          />}
          {generatedReport?.selection.sections.includes('composicoes') && <ConjuntosPorCavalo rows={financeiro.conjuntosPorCavalo || []} selection={generatedReport.selection} />}
        </>
        )
      )}
    </section>
  );
}

function ReportCustomization({
  reportType,
  selection,
  onChange,
}: {
  reportType: VisibleReportType;
  selection: ReportSelection;
  onChange: (selection: ReportSelection) => void;
}) {
  const config = reportConfigs[reportType];
  const defaults = defaultReportSelection(reportType);
  const allSectionsSelected = selection.sections.length === config.sections.length;
  const allColumnsSelected = selection.columns.length === defaults.columns.length;
  const activeColumnGroups = config.columnGroups.filter((group) => selection.sections.includes(group.sectionId));

  function toggleSection(sectionId: string) {
    onChange({
      ...selection,
      sections: selection.sections.includes(sectionId)
        ? selection.sections.filter((item) => item !== sectionId)
        : [...selection.sections, sectionId],
    });
  }

  function toggleColumn(columnId: string) {
    onChange({
      ...selection,
      columns: selection.columns.includes(columnId)
        ? selection.columns.filter((item) => item !== columnId)
        : [...selection.columns, columnId],
    });
  }

  return (
    <div className="report-customization">
        <div className="report-option-heading">
          <div>
            <strong>Conteúdo do relatório</strong>
            <span> Escolha as seções que serão exibidas e exportadas.</span>
          </div>
          <div className="actions">
            <button
              className="button ghost"
              type="button"
              onClick={() => onChange(defaults)}
            >
              Restaurar padrão
            </button>
            <button
              className="button ghost"
              type="button"
              onClick={() => onChange({
                ...selection,
                sections: allSectionsSelected ? [] : config.sections.map((section) => section.id),
              })}
            >
              {allSectionsSelected ? 'Desmarcar tudo' : 'Selecionar tudo'}
            </button>
          </div>
        </div>
        <div className="report-option-grid">
          {config.sections.map((section) => (
            <label className="check-row report-option-item" key={section.id}>
              <input
                type="checkbox"
                checked={selection.sections.includes(section.id)}
                onChange={() => toggleSection(section.id)}
              />
              <span>{section.label}</span>
            </label>
          ))}
        </div>

        <details className="report-advanced-options">
          <summary>Opções avançadas — escolher colunas</summary>
          <div className="report-option-heading">
            <span>Somente as tabelas selecionadas acima são exibidas.</span>
            <button
              className="button ghost"
              type="button"
              onClick={() => onChange({
                ...selection,
                columns: allColumnsSelected ? [] : defaults.columns,
              })}
            >
              {allColumnsSelected ? 'Desmarcar colunas' : 'Selecionar todas as colunas'}
            </button>
          </div>
          {!activeColumnGroups.length && <div className="empty-inline">Selecione uma seção com tabela para configurar suas colunas.</div>}
          {activeColumnGroups.map((group) => (
            <div className="report-column-group" key={group.id}>
              <strong>{group.label}</strong>
              <div className="report-option-grid">
                {group.columns.map((column) => {
                  const columnId = reportColumnId(group.id, column.key);
                  return (
                    <label className="check-row report-option-item" key={columnId}>
                      <input
                        type="checkbox"
                        checked={selection.columns.includes(columnId)}
                        onChange={() => toggleColumn(columnId)}
                      />
                      <span>{column.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </details>
    </div>
  );
}

function CommissionReport({ comissoes, selection }: { comissoes: any; selection: ReportSelection }) {
  const resumo = comissoes?.resumo || {};
  const historico = comissoes?.historico || [];
  const [sort, setSort] = useState<TableSort>({ orderBy: 'data', orderDirection: 'desc' });
  const sortedHistorico = useMemo(() => sortTableRows<any>(historico, sort, {
    data: (item) => new Date(item.data),
    cavalo: (item) => item.cavaloMecanico?.placa || item.placa,
    motorista: (item) => item.motorista?.nome,
    eixos: (item) => Number(item.quantidadeEixosComissao),
    tipo: (item) => commissionTypeLabel(item.tipoComissao),
    regra: (item) => item.tipoComissao === 'PERCENTUAL' ? Number(item.percentualComissao) : Number(item.valorComissaoPorViagem),
    faturamento: (item) => Number(item.valorTotal),
    bruta: (item) => Number(item.valorComissaoBruta ?? item.valorComissao),
    impostos: (item) => Number(item.valorDescontoImpostos || 0),
    liquida: (item) => Number(item.valorComissao),
    aposComissao: (item) => Number(item.valorTotal || 0) - Number(item.valorComissao || 0),
  }), [historico, sort]);

  return (
    <>
      <div className="panel-title-row report-section-heading">
        <div>
          <h2>Comissões dos faturamentos</h2>
          <p>Valores gravados em cada viagem. As comissões já estão incluídas no total de despesas e no saldo final.</p>
        </div>
      </div>
      <div className="stats-grid">
        <article className="stat-card stat-neutral"><span>Viagens com comissão</span><strong>{resumo.quantidade || 0}</strong></article>
        <article className="stat-card stat-success"><span>Faturamento relacionado</span><strong>{money(resumo.totalFaturado)}</strong></article>
        <article className="stat-card stat-danger"><span>Total de comissões</span><strong>{money(resumo.totalComissoes)}</strong></article>
        <article className="stat-card stat-info"><span>Faturamento após comissões</span><strong>{money(resumo.faturamentoAposComissoes)}</strong></article>
      </div>

      <div className="panel report-table-panel">
        <div className="panel-title-row">
          <div>
            <h2>Histórico de comissões</h2>
            <p>Regra, base de cálculo e despesa automática vinculada a cada faturamento.</p>
            {comissoes?.historicoLimitado && (
              <p>Exibindo {historico.length} de {comissoes.historicoTotal} registros nesta consulta. A exportação inclui todos os registros.</p>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {hasColumn(selection, 'comissoes', 'data') && <SortableHeader label="Data" sortKey="data" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'cavalo') && <SortableHeader label="Cavalo" sortKey="cavalo" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'motorista') && <SortableHeader label="Motorista" sortKey="motorista" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'eixos') && <SortableHeader label="Eixos" sortKey="eixos" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'tipo') && <SortableHeader label="Tipo" sortKey="tipo" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'regra') && <SortableHeader label="Regra aplicada" sortKey="regra" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'faturamento') && <SortableHeader label="Faturamento" sortKey="faturamento" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'bruta') && <SortableHeader label="Comissão bruta" sortKey="bruta" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'impostos') && <SortableHeader label="Impostos" sortKey="impostos" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'liquida') && <SortableHeader label="Comissão líquida" sortKey="liquida" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'comissoes', 'aposComissao') && <SortableHeader label="Após comissão" sortKey="aposComissao" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
              </tr>
            </thead>
            <tbody>
              {!historico.length && <tr><td colSpan={selectedColumnCount(selection, 'comissoes')}>Nenhuma comissão encontrada para os filtros informados.</td></tr>}
              {sortedHistorico.map((item: any) => (
                <tr key={item.id}>
                  {hasColumn(selection, 'comissoes', 'data') && <td>{date(item.data)}</td>}
                  {hasColumn(selection, 'comissoes', 'cavalo') && <td>{item.cavaloMecanico?.placa || item.placa || '-'}</td>}
                  {hasColumn(selection, 'comissoes', 'motorista') && <td>{labelPessoa(item.motorista)}</td>}
                  {hasColumn(selection, 'comissoes', 'eixos') && <td>{item.quantidadeEixosComissao ?? '-'}</td>}
                  {hasColumn(selection, 'comissoes', 'tipo') && <td>{commissionTypeLabel(item.tipoComissao)}</td>}
                  {hasColumn(selection, 'comissoes', 'regra') && <td>{commissionRuleLabel(item)}</td>}
                  {hasColumn(selection, 'comissoes', 'faturamento') && <td className="money-cell positive">{money(item.valorTotal)}</td>}
                  {hasColumn(selection, 'comissoes', 'bruta') && <td className="money-cell negative">{money(item.valorComissaoBruta ?? item.valorComissao)}</td>}
                  {hasColumn(selection, 'comissoes', 'impostos') && <td className="money-cell">{item.descontoImpostos ? `- ${money(item.valorDescontoImpostos)}` : money(0)}</td>}
                  {hasColumn(selection, 'comissoes', 'liquida') && <td className="money-cell negative">{money(item.valorComissao)}</td>}
                  {hasColumn(selection, 'comissoes', 'aposComissao') && <td className="money-cell">{money(Number(item.valorTotal || 0) - Number(item.valorComissao || 0))}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ConsumoReport({ consumo, selection }: { consumo: any; selection: ReportSelection }) {
  const resumo = consumo?.resumo || {};
  const porCavalo = consumo?.porCavalo || [];
  const historico = consumo?.historico || [];
  const periodoComparacao = consumo?.periodoComparacao;
  const [rankingSort, setRankingSort] = useState<TableSort>({ orderBy: 'posicao', orderDirection: 'asc' });
  const [historySort, setHistorySort] = useState<TableSort>({ orderBy: 'data', orderDirection: 'desc' });
  const sortedRanking = useMemo(() => sortTableRows<any>(porCavalo, rankingSort, {
    posicao: (item) => item.posicao,
    cavalo: (item) => item.cavalo,
    abastecimentos: (item) => Number(item.quantidadeRegistros),
    distancia: (item) => Number(item.distanciaTotal),
    litros: (item) => Number(item.litrosTotal),
    mediaAtual: (item) => Number(item.mediaGeralKmLitro),
    mediaAnterior: (item) => item.mediaPeriodoAnterior == null ? null : Number(item.mediaPeriodoAnterior),
    variacao: (item) => item.variacaoPercentual == null ? null : Number(item.variacaoPercentual),
    divergencias: (item) => Number(item.quantidadeDivergencias),
    amostra: (item) => item.amostraConfiavel ? 1 : 0,
  }), [porCavalo, rankingSort]);
  const sortedHistory = useMemo(() => sortTableRows<any>(historico, historySort, {
    data: (item) => new Date(item.data),
    cavalo: (item) => item.cavaloMecanico?.placa,
    kmAnterior: (item) => Number(item.kmAnterior),
    kmAtual: (item) => Number(item.kmAtual),
    distancia: (item) => Number(item.distanciaPercorrida),
    litros: (item) => Number(item.litros),
    media: (item) => Number(item.mediaKmLitro),
  }), [historico, historySort]);

  return (
    <>
      <div className="panel-title-row report-section-heading">
        <div>
          <h2>Média da frota</h2>
          <p>Ranking calculado pela distância total dividida pelo total de litros de cada cavalo.</p>
        </div>
      </div>
      {selection.sections.includes('resumo_frota') && <div className="stats-grid">
        <article className="stat-card stat-info"><span>Média da frota</span><strong>{decimal(resumo.mediaGeralKmLitro, 2)} km/l</strong></article>
        <article className="stat-card stat-success"><span>Melhor placa</span><strong>{resumo.melhorPlaca ? `${resumo.melhorPlaca.placa} · ${decimal(resumo.melhorPlaca.mediaGeralKmLitro, 2)} km/l` : '-'}</strong></article>
        <article className="stat-card stat-danger"><span>Menor média</span><strong>{resumo.piorPlaca ? `${resumo.piorPlaca.placa} · ${decimal(resumo.piorPlaca.mediaGeralKmLitro, 2)} km/l` : '-'}</strong></article>
        <article className={`stat-card ${resumo.quantidadeDivergencias ? 'stat-danger' : 'stat-neutral'}`}><span>Divergências</span><strong>{resumo.quantidadeDivergencias || 0}</strong></article>
      </div>}

      {selection.sections.includes('ranking_frota') && <div className="panel report-table-panel">
        <div className="panel-title-row">
          <div>
            <h2>Ranking por placa</h2>
            <p>
              A média é ponderada, e placas com apenas um abastecimento são sinalizadas como amostra pequena.
              {periodoComparacao
                ? ` Comparação com ${date(periodoComparacao.dataInicial)} a ${date(periodoComparacao.dataFinal)}.`
                : ' Informe data inicial e final para comparar com o período anterior equivalente.'}
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {hasColumn(selection, 'ranking', 'posicao') && <SortableHeader label="Pos." sortKey="posicao" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'ranking', 'placa') && <SortableHeader label="Placa / cavalo" sortKey="cavalo" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'ranking', 'abastecimentos') && <SortableHeader label="Abastecimentos" sortKey="abastecimentos" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'ranking', 'distancia') && <SortableHeader label="Distância" sortKey="distancia" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'ranking', 'litros') && <SortableHeader label="Litros" sortKey="litros" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'ranking', 'media') && <SortableHeader label="Média atual" sortKey="mediaAtual" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'ranking', 'mediaAnterior') && <SortableHeader label="Média anterior" sortKey="mediaAnterior" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'ranking', 'variacao') && <SortableHeader label="Variação" sortKey="variacao" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'ranking', 'divergencias') && <SortableHeader label="Divergências" sortKey="divergencias" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'ranking', 'amostra') && <SortableHeader label="Amostra" sortKey="amostra" sort={rankingSort} onSort={(key) => setRankingSort((current) => nextTableSort(current, key))} />}
              </tr>
            </thead>
            <tbody>
              {!porCavalo.length && <tr><td colSpan={selectedColumnCount(selection, 'ranking')}>Nenhum abastecimento encontrado para os filtros informados.</td></tr>}
              {sortedRanking.map((item: any) => (
                <tr key={item.cavaloMecanicoId}>
                  {hasColumn(selection, 'ranking', 'posicao') && <td><strong>{item.posicao == null ? '-' : `${item.posicao}º`}</strong></td>}
                  {hasColumn(selection, 'ranking', 'placa') && <td>{item.cavalo}</td>}
                  {hasColumn(selection, 'ranking', 'abastecimentos') && <td>{item.quantidadeRegistros}</td>}
                  {hasColumn(selection, 'ranking', 'distancia') && <td>{decimal(item.distanciaTotal, 1)} km</td>}
                  {hasColumn(selection, 'ranking', 'litros') && <td>{decimal(item.litrosTotal, 2)} L</td>}
                  {hasColumn(selection, 'ranking', 'media') && <td><strong>{decimal(item.mediaGeralKmLitro, 2)} km/l</strong></td>}
                  {hasColumn(selection, 'ranking', 'mediaAnterior') && <td>{item.mediaPeriodoAnterior == null ? '-' : `${decimal(item.mediaPeriodoAnterior, 2)} km/l`}</td>}
                  {hasColumn(selection, 'ranking', 'variacao') && <td className={`money-cell ${item.variacaoPercentual > 0 ? 'positive' : item.variacaoPercentual < 0 ? 'negative' : ''}`}>
                    {item.variacaoPercentual == null ? '-' : `${item.variacaoPercentual > 0 ? '+' : ''}${decimal(item.variacaoPercentual, 2)}%`}
                  </td>}
                  {hasColumn(selection, 'ranking', 'divergencias') && <td>{item.quantidadeDivergencias || 0}</td>}
                  {hasColumn(selection, 'ranking', 'amostra') && <td>{item.amostraConfiavel ? 'Confiável' : 'Pequena'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      {selection.sections.includes('comparacao_periodo') && (
        <ComparisonReport rows={porCavalo} periodo={periodoComparacao} selection={selection} />
      )}

      {selection.sections.includes('historico_abastecimentos') && <div className="panel report-table-panel">
        <div className="panel-title-row">
          <div>
            <h2>Histórico de abastecimentos</h2>
            <p>Últimos registros encontrados para o período e o cavalo selecionado.</p>
            {consumo?.historicoLimitado && (
              <p>Exibindo {historico.length} de {consumo.historicoTotal} registros nesta consulta. A exportação inclui todos os registros.</p>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {hasColumn(selection, 'historico', 'data') && <SortableHeader label="Data" sortKey="data" sort={historySort} onSort={(key) => setHistorySort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'historico', 'cavalo') && <SortableHeader label="Cavalo" sortKey="cavalo" sort={historySort} onSort={(key) => setHistorySort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'historico', 'kmAnterior') && <SortableHeader label="Km anterior" sortKey="kmAnterior" sort={historySort} onSort={(key) => setHistorySort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'historico', 'kmAtual') && <SortableHeader label="Km atual" sortKey="kmAtual" sort={historySort} onSort={(key) => setHistorySort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'historico', 'distancia') && <SortableHeader label="Distância" sortKey="distancia" sort={historySort} onSort={(key) => setHistorySort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'historico', 'litros') && <SortableHeader label="Litros" sortKey="litros" sort={historySort} onSort={(key) => setHistorySort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'historico', 'media') && <SortableHeader label="Média" sortKey="media" sort={historySort} onSort={(key) => setHistorySort((current) => nextTableSort(current, key))} />}
                {hasColumn(selection, 'historico', 'status') && <th>Status</th>}
              </tr>
            </thead>
            <tbody>
              {!historico.length && <tr><td colSpan={selectedColumnCount(selection, 'historico')}>Nenhum abastecimento encontrado para os filtros informados.</td></tr>}
              {sortedHistory.map((item: any) => (
                <tr key={item.id} className={item.divergente ? 'consumo-divergente' : ''}>
                  {hasColumn(selection, 'historico', 'data') && <td>{date(item.data)}</td>}
                  {hasColumn(selection, 'historico', 'cavalo') && <td>{item.cavaloMecanico?.placa || '-'}</td>}
                  {hasColumn(selection, 'historico', 'kmAnterior') && <td>{decimal(item.kmAnterior, 1)}</td>}
                  {hasColumn(selection, 'historico', 'kmAtual') && <td>{decimal(item.kmAtual, 1)}</td>}
                  {hasColumn(selection, 'historico', 'distancia') && <td>{decimal(item.distanciaPercorrida, 1)} km</td>}
                  {hasColumn(selection, 'historico', 'litros') && <td>{decimal(item.litros, 2)} L</td>}
                  {hasColumn(selection, 'historico', 'media') && <td><strong>{decimal(item.mediaKmLitro, 2)} km/l</strong></td>}
                  {hasColumn(selection, 'historico', 'status') && <td>{item.divergente ? 'Sequência divergente' : 'OK'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </>
  );
}

function ComparisonReport({ rows, periodo, selection }: { rows: any[]; periodo: any; selection: ReportSelection }) {
  return (
    <div className="panel report-table-panel">
      <div className="panel-title-row">
        <div>
          <h2>Comparação com o período anterior</h2>
          <p>{periodo ? `${date(periodo.dataInicial)} a ${date(periodo.dataFinal)}` : 'Informe data inicial e final para comparar períodos equivalentes.'}</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {hasColumn(selection, 'comparacao', 'placa') && <th>Placa</th>}
              {hasColumn(selection, 'comparacao', 'mediaAtual') && <th>Média atual</th>}
              {hasColumn(selection, 'comparacao', 'mediaAnterior') && <th>Média anterior</th>}
              {hasColumn(selection, 'comparacao', 'variacao') && <th>Variação</th>}
            </tr>
          </thead>
          <tbody>
            {!periodo && <tr><td colSpan={selectedColumnCount(selection, 'comparacao')}>Período de comparação não informado.</td></tr>}
            {periodo && rows.map((item) => (
              <tr key={item.cavaloMecanicoId}>
                {hasColumn(selection, 'comparacao', 'placa') && <td>{item.placa || item.cavalo}</td>}
                {hasColumn(selection, 'comparacao', 'mediaAtual') && <td>{decimal(item.mediaGeralKmLitro, 2)} km/l</td>}
                {hasColumn(selection, 'comparacao', 'mediaAnterior') && <td>{item.mediaPeriodoAnterior == null ? '-' : `${decimal(item.mediaPeriodoAnterior, 2)} km/l`}</td>}
                {hasColumn(selection, 'comparacao', 'variacao') && <td className={`money-cell ${item.variacaoPercentual > 0 ? 'positive' : item.variacaoPercentual < 0 ? 'negative' : ''}`}>{item.variacaoPercentual == null ? '-' : `${item.variacaoPercentual > 0 ? '+' : ''}${decimal(item.variacaoPercentual, 2)}%`}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalsByDimension({
  title,
  description,
  expenseTitle,
  revenueTitle,
  expenses,
  revenues,
}: {
  title: string;
  description: string;
  expenseTitle?: string;
  revenueTitle?: string;
  expenses?: any[];
  revenues?: any[];
}) {
  return (
    <section className="report-summary-section">
      <div className="panel-title-row report-section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
          {title.startsWith('Valores relacionados a implementos') && (
            <p><strong>Importante:</strong> o valor integral é associado a cada implemento do conjunto; não some os implementos entre si.</p>
          )}
          {title.startsWith('Placa registrada') && (
            <p>Este é o texto gravado no lançamento e pode divergir do cavalo mecânico atualmente relacionado.</p>
          )}
        </div>
      </div>
      <div className="report-grid">
        {expenseTitle && <Group title={expenseTitle} rows={expenses || []} />}
        {revenueTitle && <Group title={revenueTitle} rows={revenues || []} />}
      </div>
    </section>
  );
}

function Group({ title, rows }: { title: string; rows: any[] }) {
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  return (
    <div className="panel report-group-card">
      <div className="group-title">
        <h2>{title}</h2>
        <BarChart3 size={18} />
      </div>
      {!rows.length && <div className="empty-inline">Nenhum registro encontrado.</div>}
      {rows.map((row, index) => {
        const percent = total ? Math.max(4, Math.round((Number(row.total || 0) / total) * 100)) : 0;
        return (
          <div className="group-row" key={index}>
            <div>
              <strong>{row.label}</strong>
              <span>{money(row.total)}</span>
            </div>
            <div className="group-meter"><span style={{ width: `${percent}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function ConjuntosPorCavalo({ rows, selection }: { rows: any[]; selection: ReportSelection }) {
  const [sort, setSort] = useState<TableSort>({ orderBy: 'cavalo', orderDirection: 'asc' });
  const sortedRows = useMemo(() => sortTableRows<any>(rows, sort, {
    cavalo: (row) => row.cavalo,
    conjunto: (row) => row.conjunto,
    tipo: (row) => row.tipoConjunto,
    eixos: (row) => Number(row.quantidadeTotalEixos),
    implementos: (row) => row.implementos,
    lancamentos: (row) => Number(row.quantidadeLancamentos),
    despesas: (row) => Number(row.totalDespesas),
    faturamento: (row) => Number(row.totalFaturamento),
    saldo: (row) => Number(row.saldo),
  }), [rows, sort]);

  return (
    <div className="panel report-table-panel">
      <div className="panel-title-row">
        <div>
          <h2>Resumo por composição do cavalo</h2>
          <p>Resultado consolidado por cavalo e conjunto operacional.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {hasColumn(selection, 'composicoes', 'cavalo') && <SortableHeader label="Cavalo" sortKey="cavalo" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
              {hasColumn(selection, 'composicoes', 'conjunto') && <SortableHeader label="Conjunto" sortKey="conjunto" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
              {hasColumn(selection, 'composicoes', 'tipo') && <SortableHeader label="Tipo" sortKey="tipo" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
              {hasColumn(selection, 'composicoes', 'eixos') && <SortableHeader label="Eixos" sortKey="eixos" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
              {hasColumn(selection, 'composicoes', 'implementos') && <SortableHeader label="Implementos" sortKey="implementos" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
              {hasColumn(selection, 'composicoes', 'lancamentos') && <SortableHeader label="Lanc." sortKey="lancamentos" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
              {hasColumn(selection, 'composicoes', 'despesas') && <SortableHeader label="Despesas" sortKey="despesas" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
              {hasColumn(selection, 'composicoes', 'faturamento') && <SortableHeader label="Faturamento" sortKey="faturamento" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
              {hasColumn(selection, 'composicoes', 'saldo') && <SortableHeader label="Saldo" sortKey="saldo" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} />}
            </tr>
          </thead>
          <tbody>
            {!rows.length && <tr><td colSpan={selectedColumnCount(selection, 'composicoes')}>Nenhum conjunto encontrado para os filtros informados.</td></tr>}
            {sortedRows.map((row, index) => (
              <tr key={`${row.cavaloId}-${row.conjuntoId || index}`}>
                {hasColumn(selection, 'composicoes', 'cavalo') && <td>{row.cavalo || '-'}</td>}
                {hasColumn(selection, 'composicoes', 'conjunto') && <td>{row.conjunto || '-'}</td>}
                {hasColumn(selection, 'composicoes', 'tipo') && <td>{row.tipoConjunto || '-'}</td>}
                {hasColumn(selection, 'composicoes', 'eixos') && <td>{row.quantidadeTotalEixos ?? '-'}</td>}
                {hasColumn(selection, 'composicoes', 'implementos') && <td>{row.implementos || '-'}</td>}
                {hasColumn(selection, 'composicoes', 'lancamentos') && <td>{row.quantidadeLancamentos}</td>}
                {hasColumn(selection, 'composicoes', 'despesas') && <td className="money-cell negative">{money(row.totalDespesas)}</td>}
                {hasColumn(selection, 'composicoes', 'faturamento') && <td className="money-cell positive">{money(row.totalFaturamento)}</td>}
                {hasColumn(selection, 'composicoes', 'saldo') && <td className={`money-cell ${row.saldo >= 0 ? 'positive' : 'negative'}`}>{money(row.saldo)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: string;
  sort: TableSort;
  onSort: (sortKey: string) => void | Promise<void>;
}) {
  const active = sort.orderBy === sortKey;
  return (
    <th aria-sort={active ? (sort.orderDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        className={`sortable-header ${active ? 'active' : ''}`}
        type="button"
        title={`Ordenar por ${label}`}
        onClick={() => void onSort(sortKey)}
      >
        <span>{label}</span>
        {active
          ? sort.orderDirection === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />
          : <ArrowUpDown size={15} />}
      </button>
    </th>
  );
}

function SelectFilter({ label, name, value, options, disabled, onChange }: { label: string; name: string; value: string; options: Option[]; disabled?: boolean; onChange: (name: string, value: string) => void }) {
  return (
    <label>
      {label}
      <SearchableSelect
        value={value}
        options={options}
        emptyLabel="Todos"
        disabled={disabled}
        ariaLabel={label}
        onChange={(nextValue) => onChange(name, nextValue)}
      />
    </label>
  );
}

function MultiSelectFilter({ label, name, value, options, disabled, onChange }: { label: string; name: string; value: string[]; options: Option[]; disabled?: boolean; onChange: (name: string, value: string[]) => void }) {
  return (
    <label>
      {label}
      <MultiSearchableSelect
        value={value}
        options={options}
        placeholder="Todos"
        disabled={disabled}
        ariaLabel={label}
        onChange={(nextValue) => onChange(name, nextValue)}
      />
    </label>
  );
}

function filterArray(value?: string) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) || [];
}

function hasColumn(selection: ReportSelection | undefined, group: string, column: string) {
  return Boolean(selection?.columns.includes(reportColumnId(group, column)));
}

function selectedColumnCount(selection: ReportSelection | undefined, group: string) {
  return Math.max(1, selection?.columns.filter((column) => column.startsWith(`${group}:`)).length || 0);
}

function TipoBadge({ tipo }: { tipo: string }) {
  const despesa = tipo === 'DESPESA';
  return <span className={`type-badge ${despesa ? 'danger' : 'success'}`}>{despesa ? 'Despesa' : 'Faturamento'}</span>;
}

function labelPessoa(item: any) {
  if (!item) return '-';
  return [item.nome, item.documento || item.cpf].filter(Boolean).join(' - ') || '-';
}

function labelConjunto(conjunto: any) {
  if (!conjunto) return 'Sem conjunto registrado';
  return [conjunto.tipo, conjunto.quantidadeTotalEixos != null ? `${conjunto.quantidadeTotalEixos} eixos` : null].filter(Boolean).join(' - ');
}

function labelImplementos(conjunto: any) {
  const implementos = conjunto?.implementos || [];
  if (!conjunto) return 'Sem composição registrada neste lançamento';
  if (!implementos.length) return 'Sem implementos registrados';
  return implementos.map((vinculo: any) => {
    const implemento = vinculo.implemento;
    return [vinculo.ordem ? `${vinculo.ordem}.` : null, implemento?.placa || 'Sem placa', implemento?.tipo, implemento?.carroceria, implemento?.quantidadeEixos != null ? `${implemento.quantidadeEixos} eixos` : null].filter(Boolean).join(' ');
  }).join(' / ');
}

function commissionTypeLabel(tipo: string) {
  if (tipo === 'PERCENTUAL') return 'Percentual';
  if (tipo === 'POR_VIAGEM') return 'Por viagem';
  return '-';
}

function commissionRuleLabel(item: any) {
  return item?.tipoComissao === 'PERCENTUAL'
    ? `${decimal(item.percentualComissao, 2)}%`
    : `${money(item?.valorComissaoPorViagem)} por viagem`;
}

function decimal(value: unknown, digits: number) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
