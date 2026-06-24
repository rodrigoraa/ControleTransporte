import { ArrowRight, Eye, FileText, Search, UserRound, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Toast } from '../components/Toast';
import { api } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';

type AuditChange = {
  campo: string;
  label: string;
  tipo: 'ADICIONADO' | 'ALTERADO' | 'REMOVIDO';
  antes: unknown;
  depois: unknown;
};

type AuditRow = {
  id: string;
  createdAt: string;
  entidade: string;
  entidadeId?: string | null;
  acao: string;
  usuarioId?: string | null;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  usuario?: { nome: string; email: string; perfil: string } | null;
  entidadeLabel?: string;
  acaoLabel?: string;
  registroLabel?: string;
  resumo?: string;
  alteracoes?: AuditChange[];
  totalAlteracoes?: number;
};

const limit = 12;

const entityOptions = [
  { value: '', label: 'Todas as entidades' },
  { value: 'cliente', label: 'Clientes' },
  { value: 'fornecedor', label: 'Fornecedores' },
  { value: 'motorista', label: 'Motoristas' },
  { value: 'cavaloMecanico', label: 'Cavalos mecânicos' },
  { value: 'conjunto', label: 'Conjuntos operacionais' },
  { value: 'categoriaFinanceira', label: 'Categorias financeiras' },
  { value: 'lancamentoFinanceiro', label: 'Lançamentos financeiros' },
  { value: 'User', label: 'Usuários' },
];

const actionOptions = [
  { value: '', label: 'Todas as ações' },
  { value: 'CRIACAO', label: 'Criação' },
  { value: 'CRIACAO_COMPLETA', label: 'Criação completa' },
  { value: 'ATUALIZACAO', label: 'Atualização' },
  { value: 'ATUALIZACAO_COMPOSICAO', label: 'Atualização da composição' },
  { value: 'EXCLUSAO', label: 'Exclusão' },
  { value: 'RECUPERACAO_SENHA', label: 'Recuperação de senha' },
];

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function Auditorias() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entidade, setEntidade] = useState('');
  const [acao, setAcao] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const stats = useMemo(() => {
    const withUser = rows.filter((row) => row.usuario || row.usuarioId).length;
    const totalChanges = rows.reduce((sum, row) => sum + (row.totalAlteracoes || row.alteracoes?.length || 0), 0);
    const destructive = rows.filter((row) => row.acao === 'EXCLUSAO').length;
    return { withUser, totalChanges, destructive };
  }, [rows]);

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const { data } = await api.get('/auditorias', {
        params: {
          page: nextPage,
          limit,
          search: search || undefined,
          entidade: entidade || undefined,
          acao: acao || undefined,
          dataInicial: dataInicial || undefined,
          dataFinal: dataFinal || undefined,
        },
      });
      setRows(data.data);
      setTotal(data.total);
    } catch (requestError) {
      setToast({ type: 'error', message: await apiErrorMessage(requestError, 'Não foi possível carregar a auditoria.') });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page);
  }, [page]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    load(1);
  }

  return (
    <section className="page audit-page">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header audit-header">
        <div>
          <h1>Auditoria</h1>
          <p>Eventos administrativos com responsável, resumo e comparação dos dados alterados.</p>
        </div>
      </div>

      <div className="stats-grid audit-stats">
        <div className="stat-card stat-info">
          <span>Eventos filtrados</span>
          <strong>{total}</strong>
        </div>
        <div className="stat-card stat-success">
          <span>Com usuário identificado</span>
          <strong>{stats.withUser}</strong>
        </div>
        <div className="stat-card stat-neutral">
          <span>Campos alterados nesta página</span>
          <strong>{stats.totalChanges}</strong>
        </div>
        <div className="stat-card stat-danger">
          <span>Exclusões nesta página</span>
          <strong>{stats.destructive}</strong>
        </div>
      </div>

      <form className="panel audit-filters" onSubmit={submit}>
        <div className="search-box">
          <Search size={18} />
          <input placeholder="Buscar por entidade, ação, usuário ou registro..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select value={entidade} onChange={(event) => setEntidade(event.target.value)}>
          {entityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={acao} onChange={(event) => setAcao(event.target.value)}>
          {actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <input type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} />
        <input type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} />
        <button className="button primary">Filtrar</button>
      </form>

      <div className="panel audit-list-panel">
        <div className="table-wrap audit-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ação</th>
                <th>Registro</th>
                <th>Usuário</th>
                <th>Resumo</th>
                <th>Alterações</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>
                    <span className={`audit-action-badge ${actionClass(row.acao)}`}>{row.acaoLabel || row.acao}</span>
                    <small className="audit-subtext">{row.entidadeLabel || row.entidade}</small>
                  </td>
                  <td>
                    <strong>{row.registroLabel || row.entidadeId || '-'}</strong>
                    {row.entidadeId && <small className="audit-subtext">{row.entidadeId}</small>}
                  </td>
                  <td>
                    <AuditUser row={row} />
                  </td>
                  <td>{row.resumo || '-'}</td>
                  <td>
                    <span className="audit-count">{row.totalAlteracoes ?? row.alteracoes?.length ?? 0}</span>
                  </td>
                  <td className="actions">
                    <button className="icon-button" title="Ver detalhes" onClick={() => setSelected(row)}>
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={7}>Carregando auditoria...</td></tr>}
              {!loading && !rows.length && <tr><td colSpan={7}>Nenhum evento encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>{total} eventos</span>
          <button className="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <strong>{page}</strong>
          <button className="button" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>Próxima</button>
        </div>
      </div>

      {selected && <AuditDetailModal audit={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function AuditUser({ row }: { row: AuditRow }) {
  if (row.usuario) {
    return (
      <span className="audit-user">
        <UserRound size={16} />
        <span>
          <strong>{row.usuario.nome}</strong>
          <small>{row.usuario.email}</small>
        </span>
      </span>
    );
  }
  return <span className="audit-muted">{row.usuarioId || 'Sistema'}</span>;
}

function AuditDetailModal({ audit, onClose }: { audit: AuditRow; onClose: () => void }) {
  const changes = audit.alteracoes || [];
  return (
    <div className="modal-backdrop">
      <div className="modal large-modal audit-modal">
        <div className="modal-header">
          <div>
            <h2>{audit.acaoLabel || audit.acao}</h2>
            <p>{audit.resumo}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="audit-detail-grid">
          <DetailItem icon={<FileText size={16} />} label="Entidade" value={audit.entidadeLabel || audit.entidade} />
          <DetailItem icon={<FileText size={16} />} label="Registro" value={audit.registroLabel || audit.entidadeId || '-'} />
          <DetailItem icon={<UserRound size={16} />} label="Usuário" value={audit.usuario ? `${audit.usuario.nome} (${audit.usuario.email})` : audit.usuarioId || 'Sistema'} />
          <DetailItem icon={<FileText size={16} />} label="Data" value={formatDateTime(audit.createdAt)} />
        </div>

        <div className="audit-section">
          <div className="panel-title-row">
            <h2>Alterações campo a campo</h2>
            <span className="audit-count">{changes.length}</span>
          </div>
          {!changes.length && <div className="empty-inline">Sem diferença detalhada entre os dados anteriores e novos.</div>}
          <div className="audit-change-list">
            {changes.map((change) => (
              <div className="audit-change" key={`${change.campo}-${change.tipo}`}>
                <div className="audit-change-title">
                  <strong>{change.label}</strong>
                  <span className={`audit-change-type ${change.tipo.toLowerCase()}`}>{change.tipo}</span>
                </div>
                <div className="audit-change-values">
                  <ValueBox label="Antes" value={change.antes} />
                  <ArrowRight size={18} />
                  <ValueBox label="Depois" value={change.depois} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="audit-json-grid">
          <Snapshot title="Dados anteriores" value={audit.dadosAntes} />
          <Snapshot title="Dados novos" value={audit.dadosDepois} />
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="audit-detail-item">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ValueBox({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="audit-value-box">
      <span>{label}</span>
      <code>{formatValue(value)}</code>
    </div>
  );
}

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="audit-json">
      <summary>{title}</summary>
      <pre>{JSON.stringify(value ?? null, null, 2)}</pre>
    </details>
  );
}

function formatDateTime(value: string) {
  if (!value) return '-';
  return dateTime.format(new Date(value));
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function actionClass(action: string) {
  if (action.includes('EXCLUSAO')) return 'danger';
  if (action.includes('CRIACAO')) return 'success';
  if (action.includes('SENHA')) return 'neutral';
  return 'info';
}
