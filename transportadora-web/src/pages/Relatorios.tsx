import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { money } from '../utils/formatters';

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
      <div className="page-header">
        <div>
          <h1>Relatórios</h1>
          <p>Filtros por período, motorista, cavalo, implemento, conjunto, tipo de conjunto, quantidade de eixos e financeiro.</p>
        </div>
      </div>
      <form className="panel report-filters" onSubmit={submit}>
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
        <button className="button primary" disabled={loading}>{loading ? 'Gerando...' : 'Gerar relatório'}</button>
      </form>
      {error && <div className="form-error">{error}</div>}
      {financeiro && (
        <>
          <div className="stats-grid">
            <article className="stat-card"><span>Total de despesas</span><strong>{money(financeiro.totalDespesas)}</strong></article>
            <article className="stat-card"><span>Total de faturamento</span><strong>{money(financeiro.totalFaturamento)}</strong></article>
            <article className="stat-card"><span>Saldo final</span><strong>{money(financeiro.saldoFinal)}</strong></article>
          </div>
          <div className="panel">
            <div className="panel-title-row">
              <div>
                <h2>Lançamentos encontrados</h2>
                <p>Detalhamento das despesas e faturamentos, incluindo a composição registrada no momento do lançamento.</p>
              </div>
              <div className="actions">
                <button className="button" type="button" onClick={() => exportReport('csv')}>Exportar Excel</button>
                <button className="button" type="button" onClick={() => exportReport('pdf')}>Exportar PDF</button>
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
                      <td>{new Date(item.data).toLocaleDateString('pt-BR')}</td>
                      <td>{item.tipoLancamento}</td>
                      <td>{item.cavaloMecanico?.placa || item.placa}</td>
                      <td>{labelConjunto(item.conjunto)}</td>
                      <td>{labelImplementos(item.conjunto)}</td>
                      <td>{labelPessoa(item.motorista)}</td>
                      <td>{labelPessoa(item.fornecedor) !== '-' ? labelPessoa(item.fornecedor) : labelPessoa(item.cliente)}</td>
                      <td>{item.categoriaFinanceira?.nome || '-'}</td>
                      <td>{Number(item.quantidade).toLocaleString('pt-BR')} {item.unidadeQuantidade}</td>
                      <td>{money(item.valorUnitario)}</td>
                      <td>{money(item.valorTotal)}</td>
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

function Group({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>Total</th></tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={index}><td>{row.label}</td><td>{money(row.total)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConjuntosPorCavalo({ rows }: { rows: any[] }) {
  return (
    <div className="panel">
      <h2>Resumo por composição do cavalo</h2>
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
                <td>{money(row.totalDespesas)}</td>
                <td>{money(row.totalFaturamento)}</td>
                <td>{money(row.saldo)}</td>
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
      <select value={value} disabled={disabled} onChange={(event) => onChange(name, event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
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





