import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { money } from '../utils/formatters';

type Option = { value: string; label: string };
type ReportOptions = {
  motoristas: Option[];
  caminhoes: Option[];
  fornecedores: Option[];
  clientes: Option[];
  categorias: Option[];
  tipos: Option[];
  placas: Option[];
};

export function Relatorios() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [financeiro, setFinanceiro] = useState<any>(null);
  const [acompanhamentos, setAcompanhamentos] = useState<any>(null);
  const [options, setOptions] = useState<ReportOptions>({
    motoristas: [],
    caminhoes: [],
    fornecedores: [],
    clientes: [],
    categorias: [],
    tipos: [],
    placas: [],
  });

  useEffect(() => {
    api.get('/relatorios/opcoes').then((response) => setOptions(response.data));
  }, []);

  const placasFiltradas = filters.caminhaoId
    ? options.caminhoes
        .filter((option) => option.value === filters.caminhaoId)
        .map((option) => {
          const placa = option.label.split(' - ')[0];
          return { value: placa, label: placa };
        })
    : options.placas;

  function updateFilter(name: string, value: string) {
    const next = { ...filters, [name]: value };
    if (name === 'caminhaoId') {
      const caminhao = options.caminhoes.find((option) => option.value === value);
      next.placa = caminhao ? caminhao.label.split(' - ')[0] : '';
    }
    setFilters(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const [fin, acomp] = await Promise.all([
      api.get('/relatorios/financeiros', { params }),
      api.get('/relatorios/acompanhamentos', { params }),
    ]);
    setFinanceiro(fin.data);
    setAcompanhamentos(acomp.data);
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Relatorios</h1>
          <p>Filtros por periodo, motorista, caminhao, placa, fornecedor, cliente, tipo e categoria.</p>
        </div>
      </div>
      <form className="panel report-filters" onSubmit={submit}>
        {[
          ['dataInicial', 'Data inicial', 'date'],
          ['dataFinal', 'Data final', 'date'],
        ].map(([name, label, type]) => (
          <label key={name}>
            {label}
            <input type={type} value={filters[name] || ''} onChange={(e) => setFilters({ ...filters, [name]: e.target.value })} />
          </label>
        ))}
        <SelectFilter label="Motorista" name="motoristaId" value={filters.motoristaId || ''} options={options.motoristas} onChange={updateFilter} />
        <SelectFilter label="Caminhao" name="caminhaoId" value={filters.caminhaoId || ''} options={options.caminhoes} onChange={updateFilter} />
        <SelectFilter label="Placa" name="placa" value={filters.placa || ''} options={placasFiltradas} disabled={Boolean(filters.caminhaoId)} onChange={updateFilter} />
        <SelectFilter label="Fornecedor" name="fornecedorId" value={filters.fornecedorId || ''} options={options.fornecedores} onChange={updateFilter} />
        <SelectFilter label="Cliente" name="clienteId" value={filters.clienteId || ''} options={options.clientes} onChange={updateFilter} />
        <label>
          Tipo
          <select value={filters.tipoLancamento || ''} onChange={(e) => setFilters({ ...filters, tipoLancamento: e.target.value })}>
            <option value="">Todos</option>
            {options.tipos.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Categoria
          <select value={filters.categoriaId || ''} onChange={(e) => setFilters({ ...filters, categoriaId: e.target.value })}>
            <option value="">Todas</option>
            {options.categorias.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button className="button primary">Gerar relatorio</button>
      </form>
      {financeiro && (
        <>
          <div className="stats-grid">
            <article className="stat-card"><span>Total de despesas</span><strong>{money(financeiro.totalDespesas)}</strong></article>
            <article className="stat-card"><span>Total de faturamento</span><strong>{money(financeiro.totalFaturamento)}</strong></article>
            <article className="stat-card"><span>Saldo final</span><strong>{money(financeiro.saldoFinal)}</strong></article>
          </div>
          <div className="panel">
            <h2>Historico de lancamentos</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Placa</th><th>Motorista</th><th>Fornecedor/Cliente</th><th>Categoria</th><th>Qtd.</th><th>Valor unitario</th><th>Valor total</th></tr>
                </thead>
                <tbody>
                  {financeiro.historico.map((item: any) => (
                    <tr key={item.id}>
                      <td>{new Date(item.data).toLocaleDateString('pt-BR')}</td>
                      <td>{item.tipoLancamento}</td>
                      <td>{item.placaOuPessoa}</td>
                      <td>{labelPessoa(item.motorista)}</td>
                      <td>{labelPessoa(item.fornecedor) !== '-' ? labelPessoa(item.fornecedor) : labelPessoa(item.cliente)}</td>
                      <td>{item.categoriaFinanceira?.nome || item.categoria || '-'}</td>
                      <td>{Number(item.quantidade).toLocaleString('pt-BR')} {item.unidadeQuantidade}</td>
                      <td>{money(item.valorUnitario)}</td>
                      <td>{money(item.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="report-grid">
            <Group title="Despesas por caminhao" rows={financeiro.despesasPorCaminhao} />
            <Group title="Despesas por motorista" rows={financeiro.despesasPorMotorista} />
            <Group title="Faturamento por caminhao" rows={financeiro.faturamentoPorCaminhao} />
            <Group title="Faturamento por motorista" rows={financeiro.faturamentoPorMotorista} />
          </div>
        </>
      )}
      {acompanhamentos && (
        <div className="panel">
          <h2>Relatorio de acompanhamentos</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Caminhao</th><th>Motorista</th><th>Operacao</th><th>Tipo veiculo</th><th>Status</th></tr></thead>
              <tbody>
                {acompanhamentos.historico.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.caminhao?.placa}</td>
                    <td>{item.motorista?.nome}</td>
                    <td>{item.tipoOperacao}</td>
                    <td>{item.tipoVeiculo}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
            {rows.map((row, index) => (
              <tr key={index}><td>{row.label}</td><td>{money(row.total)}</td></tr>
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

function labelCaminhao(item: any) {
  if (!item) return '-';
  return [item.placa, item.marca, item.modelo].filter(Boolean).join(' - ') || '-';
}
