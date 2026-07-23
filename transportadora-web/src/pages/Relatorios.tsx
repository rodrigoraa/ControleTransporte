import { FormEvent, useEffect, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, FileText, Filter, Search } from 'lucide-react';
import { api } from '../services/api';
import { SearchableSelect } from '../components/SearchableSelect';
import { apiErrorMessage } from '../utils/apiError';
import { date, money } from '../utils/formatters';

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
  placas: Option[];
};

const tiposConjunto = [
  { value: 'SIMPLES', label: 'Simples' },
  { value: 'BITREM', label: 'Bitrem' },
  { value: 'RODOTREM', label: 'Rodotrem' },
  { value: 'OUTRO', label: 'Outro' },
];

export function Relatorios() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [financeiro, setFinanceiro] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<ReportOptions>({
    motoristas: [],
    cavalosMecanicos: [],
    implementos: [],
    conjuntos: [],
    fornecedores: [],
    clientes: [],
    categorias: [],
    tipos: [],
    placas: [],
  });
  const activeFilters = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    api.get('/relatorios/opcoes').then((response) => setOptions(response.data));
  }, []);

  function updateFilter(name: string, value: string) {
    const next = { ...filters, [name]: value };
    setPage(1);
    setFilters(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    await loadReport(1);
  }

  async function loadReport(targetPage = page) {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    try {
      const { data } = await api.get('/relatorios/financeiros', { params: { ...params, page: targetPage, limit: 50 } });
      setPage(targetPage);
      setFinanceiro(data);
    } catch (requestError: any) {
      setError(await apiErrorMessage(requestError, 'Não foi possível gerar o relatório.'));
    } finally {
      setLoading(false);
    }
  }

  async function exportReport(format: 'csv' | 'pdf') {
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const { data } = await api.get(`/relatorios/financeiros/exportar.${format}`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-financeiro.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError: any) {
      setError(await apiErrorMessage(requestError, `Não foi possível exportar o relatório em ${format.toUpperCase()}.`));
    }
  }

  return (
    <section className="page">
      <div className="page-header report-header">
        <div>
          <h1>Relatórios</h1>
          <p>Indicadores financeiros, de comissões e de consumo por período, frota, composição e categoria.</p>
        </div>
        {financeiro && (
          <div className="actions">
            <button className="button" type="button" onClick={() => exportReport('csv')}>
              <FileSpreadsheet size={18} />
              Excel
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
            <strong>{activeFilters ? `${activeFilters} filtros ativos` : 'Visão geral'}</strong>
          </div>
          <button className="button primary" disabled={loading}>
            <Search size={18} />
            {loading ? 'Gerando...' : 'Gerar relatório'}
          </button>
        </div>
        <label>Data inicial<input type="date" value={filters.dataInicial || ''} onChange={(e) => setFilters({ ...filters, dataInicial: e.target.value })} /></label>
        <label>Data final<input type="date" value={filters.dataFinal || ''} onChange={(e) => setFilters({ ...filters, dataFinal: e.target.value })} /></label>
        <SelectFilter label="Motorista" name="motoristaId" value={filters.motoristaId || ''} options={options.motoristas} onChange={updateFilter} />
        <SelectFilter label="Cavalo mecânico" name="cavaloMecanicoId" value={filters.cavaloMecanicoId || ''} options={options.cavalosMecanicos} onChange={updateFilter} />
        <SelectFilter label="Implemento" name="implementoId" value={filters.implementoId || ''} options={options.implementos} onChange={updateFilter} />
        <SelectFilter label="Conjunto operacional" name="conjuntoId" value={filters.conjuntoId || ''} options={options.conjuntos} onChange={updateFilter} />
        <SelectFilter label="Tipo de conjunto" name="tipoConjunto" value={filters.tipoConjunto || ''} options={tiposConjunto} onChange={updateFilter} />
        <label>Quantidade de eixos<input type="number" value={filters.quantidadeEixos || ''} onChange={(e) => setFilters({ ...filters, quantidadeEixos: e.target.value })} /></label>
        <SelectFilter label="Placa" name="placa" value={filters.placa || ''} options={options.placas} onChange={updateFilter} />
        <SelectFilter label="Fornecedor" name="fornecedorId" value={filters.fornecedorId || ''} options={options.fornecedores} onChange={updateFilter} />
        <SelectFilter label="Cliente" name="clienteId" value={filters.clienteId || ''} options={options.clientes} onChange={updateFilter} />
        <SelectFilter label="Tipo financeiro" name="tipoLancamento" value={filters.tipoLancamento || ''} options={options.tipos} onChange={updateFilter} />
        <SelectFilter label="Categoria" name="categoriaId" value={filters.categoriaId || ''} options={options.categorias} onChange={updateFilter} />
        <SelectFilter label="Ordenar por" name="orderBy" value={filters.orderBy || ''} options={[{ value: 'data', label: 'Data' }, { value: 'valorTotal', label: 'Valor total' }]} onChange={updateFilter} />
        <SelectFilter label="Direção" name="orderDirection" value={filters.orderDirection || ''} options={[{ value: 'desc', label: 'Decrescente' }, { value: 'asc', label: 'Crescente' }]} onChange={updateFilter} />
      </form>

      {error && <div className="form-error">{error}</div>}
      {financeiro && (
        <>
          <div className="stats-grid">
            <article className="stat-card stat-danger"><span>Total de despesas</span><strong>{money(financeiro.totalDespesas)}</strong></article>
            <article className="stat-card stat-success"><span>Total de faturamento</span><strong>{money(financeiro.totalFaturamento)}</strong></article>
            <article className={`stat-card ${financeiro.saldoFinal >= 0 ? 'stat-info' : 'stat-danger'}`}><span>Saldo final</span><strong>{money(financeiro.saldoFinal)}</strong></article>
            <article className="stat-card stat-neutral"><span>Lançamentos</span><strong>{financeiro.total}</strong></article>
          </div>

          <CommissionReport comissoes={financeiro.comissoes} />
          <ConsumoReport consumo={financeiro.consumo} />

          <div className="panel report-table-panel">
            <div className="panel-title-row">
              <div>
                <h2>Lançamentos encontrados</h2>
                <p>Detalhamento das despesas e faturamentos, incluindo a composição registrada no momento do lançamento.</p>
              </div>
              <div className="actions">
                <button className="button" type="button" onClick={() => exportReport('csv')}>
                  <FileSpreadsheet size={18} />
                  Exportar Excel
                </button>
                <button className="button" type="button" onClick={() => exportReport('pdf')}>
                  <FileText size={18} />
                  Exportar PDF
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Cavalo</th><th>Conjunto registrado</th><th>Implementos usados no lançamento</th><th>Motorista</th><th>Fornecedor/Cliente</th><th>Categoria</th><th>Qtd.</th><th>Valor unitário</th><th>Valor total</th></tr>
                </thead>
                <tbody>
                  {!financeiro.historico.length && (
                    <tr><td colSpan={11}>Nenhum lançamento encontrado para os filtros informados.</td></tr>
                  )}
                  {financeiro.historico.map((item: any) => (
                    <tr key={item.id}>
                      <td>{date(item.data)}</td>
                      <td><TipoBadge tipo={item.tipoLancamento} /></td>
                      <td>{item.cavaloMecanico?.placa || item.placa}</td>
                      <td>{labelConjunto(item.conjunto)}</td>
                      <td>{labelImplementos(item.conjunto)}</td>
                      <td>{labelPessoa(item.motorista)}</td>
                      <td>{labelPessoa(item.fornecedor) !== '-' ? labelPessoa(item.fornecedor) : labelPessoa(item.cliente)}</td>
                      <td>{item.categoriaFinanceira?.nome || '-'}</td>
                      <td>{Number(item.quantidade).toLocaleString('pt-BR')} {item.unidadeQuantidade}</td>
                      <td className="money-cell">{money(item.valorUnitario)}</td>
                      <td className={`money-cell ${item.tipoLancamento === 'DESPESA' ? 'negative' : 'positive'}`}>{money(item.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>{financeiro.total} lançamentos</span>
              <button className="button" type="button" disabled={financeiro.page === 1 || loading} onClick={() => loadReport(financeiro.page - 1)}>Anterior</button>
              <strong>{financeiro.page}</strong>
              <button className="button" type="button" disabled={financeiro.page * financeiro.limit >= financeiro.total || loading} onClick={() => loadReport(financeiro.page + 1)}>Próxima</button>
            </div>
          </div>

          <div className="report-grid">
            <Group title="Despesas por cavalo mecânico" rows={financeiro.despesasPorCavaloMecanico} />
            <Group title="Despesas por motorista" rows={financeiro.despesasPorMotorista} />
            <Group title="Faturamento por cavalo mecânico" rows={financeiro.faturamentoPorCavaloMecanico} />
            <Group title="Faturamento por motorista" rows={financeiro.faturamentoPorMotorista} />
          </div>
          <ConjuntosPorCavalo rows={financeiro.conjuntosPorCavalo || []} />
        </>
      )}
    </section>
  );
}

function CommissionReport({ comissoes }: { comissoes: any }) {
  const resumo = comissoes?.resumo || {};
  const historico = comissoes?.historico || [];

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
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Data</th><th>Cavalo</th><th>Motorista</th><th>Eixos</th><th>Tipo</th><th>Regra aplicada</th><th>Faturamento</th><th>Comissão bruta</th><th>Impostos</th><th>Comissão líquida</th><th>Após comissão</th></tr>
            </thead>
            <tbody>
              {!historico.length && <tr><td colSpan={11}>Nenhuma comissão encontrada para os filtros informados.</td></tr>}
              {historico.map((item: any) => (
                <tr key={item.id}>
                  <td>{date(item.data)}</td>
                  <td>{item.cavaloMecanico?.placa || item.placa || '-'}</td>
                  <td>{labelPessoa(item.motorista)}</td>
                  <td>{item.quantidadeEixosComissao ?? '-'}</td>
                  <td>{commissionTypeLabel(item.tipoComissao)}</td>
                  <td>{commissionRuleLabel(item)}</td>
                  <td className="money-cell positive">{money(item.valorTotal)}</td>
                  <td className="money-cell negative">{money(item.valorComissaoBruta ?? item.valorComissao)}</td>
                  <td className="money-cell">{item.descontoImpostos ? `- ${money(item.valorDescontoImpostos)}` : money(0)}</td>
                  <td className="money-cell negative">{money(item.valorComissao)}</td>
                  <td className="money-cell">{money(Number(item.valorTotal || 0) - Number(item.valorComissao || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ConsumoReport({ consumo }: { consumo: any }) {
  const resumo = consumo?.resumo || {};
  const porCavalo = consumo?.porCavalo || [];
  const historico = consumo?.historico || [];

  return (
    <>
      <div className="panel-title-row report-section-heading">
        <div>
          <h2>Consumo dos cavalos</h2>
          <p>Indicadores calculados a partir dos abastecimentos dentro do período e dos filtros selecionados.</p>
        </div>
      </div>
      <div className="stats-grid">
        <article className="stat-card stat-info"><span>Média geral</span><strong>{decimal(resumo.mediaGeralKmLitro, 3)} km/l</strong></article>
        <article className="stat-card stat-neutral"><span>Distância total</span><strong>{decimal(resumo.distanciaTotal, 1)} km</strong></article>
        <article className="stat-card stat-neutral"><span>Litros registrados</span><strong>{decimal(resumo.litrosTotal, 3)} L</strong></article>
        <article className="stat-card stat-neutral"><span>Abastecimentos</span><strong>{resumo.quantidadeRegistros || 0}</strong></article>
      </div>

      <div className="panel report-table-panel">
        <div className="panel-title-row">
          <div>
            <h2>Resumo de consumo por cavalo</h2>
            <p>A média geral é ponderada: distância total dividida pelo total de litros.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cavalo</th><th>Abastecimentos</th><th>Distância total</th><th>Litros registrados</th><th>Média geral</th></tr></thead>
            <tbody>
              {!porCavalo.length && <tr><td colSpan={5}>Nenhum abastecimento encontrado para os filtros informados.</td></tr>}
              {porCavalo.map((item: any) => (
                <tr key={item.cavaloMecanicoId}>
                  <td>{item.cavalo}</td>
                  <td>{item.quantidadeRegistros}</td>
                  <td>{decimal(item.distanciaTotal, 1)} km</td>
                  <td>{decimal(item.litrosTotal, 3)} L</td>
                  <td><strong>{decimal(item.mediaGeralKmLitro, 3)} km/l</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel report-table-panel">
        <div className="panel-title-row">
          <div>
            <h2>Histórico de abastecimentos</h2>
            <p>Últimos registros encontrados para o período e o cavalo selecionado.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Cavalo</th><th>Km anterior</th><th>Km atual</th><th>Distância</th><th>Litros</th><th>Média</th></tr></thead>
            <tbody>
              {!historico.length && <tr><td colSpan={7}>Nenhum abastecimento encontrado para os filtros informados.</td></tr>}
              {historico.map((item: any) => (
                <tr key={item.id}>
                  <td>{date(item.data)}</td>
                  <td>{item.cavaloMecanico?.placa || '-'}</td>
                  <td>{decimal(item.kmAnterior, 1)}</td>
                  <td>{decimal(item.kmAtual, 1)}</td>
                  <td>{decimal(item.distanciaPercorrida, 1)} km</td>
                  <td>{decimal(item.litros, 3)} L</td>
                  <td><strong>{decimal(item.mediaKmLitro, 3)} km/l</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
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

function ConjuntosPorCavalo({ rows }: { rows: any[] }) {
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
            <tr><th>Cavalo</th><th>Conjunto</th><th>Tipo</th><th>Eixos</th><th>Implementos</th><th>Lanc.</th><th>Despesas</th><th>Faturamento</th><th>Saldo</th></tr>
          </thead>
          <tbody>
            {!rows.length && <tr><td colSpan={9}>Nenhum conjunto encontrado para os filtros informados.</td></tr>}
            {rows.map((row, index) => (
              <tr key={`${row.cavaloId}-${row.conjuntoId || index}`}>
                <td>{row.cavalo || '-'}</td>
                <td>{row.conjunto || '-'}</td>
                <td>{row.tipoConjunto || '-'}</td>
                <td>{row.quantidadeTotalEixos ?? '-'}</td>
                <td>{row.implementos || '-'}</td>
                <td>{row.quantidadeLancamentos}</td>
                <td className="money-cell negative">{money(row.totalDespesas)}</td>
                <td className="money-cell positive">{money(row.totalFaturamento)}</td>
                <td className={`money-cell ${row.saldo >= 0 ? 'positive' : 'negative'}`}>{money(row.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
