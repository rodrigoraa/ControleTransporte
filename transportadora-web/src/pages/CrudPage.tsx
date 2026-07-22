import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Fuel } from 'lucide-react';
import { History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Toast } from '../components/Toast';
import { SearchableSelect } from '../components/SearchableSelect';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { date, maskPlate, money } from '../utils/formatters';
import { billingTotal, commissionDefaults, commissionValues, selectedCommissionValue } from '../utils/commission';
import { carrocerias, crudResources, Field, Resource, resourceListPath, tiposImplemento } from './resources';

type Mode = 'create' | 'edit' | 'view';
const relationPageLimit = 100;

export function CrudPage({ resource }: { resource: Resource }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: Mode; item: any } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [consumoCavalo, setConsumoCavalo] = useState<any | null>(null);
  const [historicoItem, setHistoricoItem] = useState<any | null>(null);
  const { user } = useAuth();
  const canWrite = user?.perfil === 'ADMIN' && !resource.readOnly;
  const limit = 10;

  const tableFields = useMemo(() => resource.fields.filter((field) => field.table), [resource]);
  const groupedRows = useMemo(() => groupRowsByOperationalStatus(resource, rows), [resource, rows]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(resource.endpoint, { params: { page, limit, search, ...resource.fixedParams } });
      setRows(data.data);
      setTotal(data.total);
    } catch (requestError) {
      setToast({ type: 'error', message: await apiErrorMessage(requestError, 'Não foi possível carregar os registros.') });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [resource.path, page]);

  async function remove(item: any) {
    try {
      await api.delete(`${resource.endpoint}/${item.id}`);
      setToast({ type: 'success', message: 'Registro excluído com sucesso.' });
      setPendingDelete(null);
      navigate(resourceListPath(resource), { replace: true });
      await load();
    } catch (requestError) {
      setToast({
        type: 'error',
        message: await apiErrorMessage(
          requestError,
          resource.path === 'caminhoes'
            ? 'Não foi possível excluir o cavalo porque ele possui vínculos. Para remover carreta/dolly, edite a composição.'
            : 'Não foi possível excluir o registro.',
        ),
      });
    }
  }

  return (
    <section className="page">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header">
        <div>
          <h1>{resource.title}</h1>
          <p>{resource.path === 'caminhoes' ? 'Cadastre o cavalo e os implementos vinculados em uma única operação.' : 'Cadastro, edição, detalhes e exclusão.'}</p>
        </div>
        {canWrite && (
          <button className="button primary" onClick={() => setModal({ mode: 'create', item: {} })}>
            <Plus size={18} /> Novo
          </button>
        )}
      </div>
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); load(); }}>
        <div className="search-box">
          <Search size={18} />
          <input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="button">Filtrar</button>
      </form>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {tableFields.map((field) => <th key={field.name}>{field.label}</th>)}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((group) => (
                <FragmentRows
                  key={group.key}
                  group={group}
                  grouped={groupedRows.length > 1}
                  tableFields={tableFields}
                  resource={resource}
                  canWrite={canWrite}
                  onConsumo={(row) => setConsumoCavalo(row)}
                  onHistorico={(row) => setHistoricoItem(row)}
                  onView={(row) => setModal({ mode: 'view', item: row })}
                  onEdit={(row) => setModal({ mode: 'edit', item: row })}
                  onDelete={(row) => setPendingDelete(row)}
                />
              ))}
              {loading && <tr><td colSpan={tableFields.length + 1}>Carregando registros...</td></tr>}
              {!loading && !rows.length && <tr><td colSpan={tableFields.length + 1}>Nenhum registro encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>{total} registros</span>
          <button className="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <strong>{page}</strong>
          <button className="button" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>Próxima</button>
        </div>
      </div>
      {modal && (
        resource.path === 'caminhoes' && modal.mode !== 'view' ? (
          <CaminhaoCompletoModal
            resource={resource}
            mode={modal.mode}
            item={modal.item}
            onClose={() => setModal(null)}
            onSaved={() => {
              setModal(null);
              setToast({ type: 'success', message: modal.mode === 'create' ? 'Cadastro completo salvo com sucesso.' : 'Composição atualizada com sucesso.' });
              navigate(resourceListPath(resource), { replace: true });
              void load();
            }}
          />
        ) : (
          <RecordModal
            resource={resource}
            mode={modal.mode}
            item={modal.item}
            onClose={() => setModal(null)}
            onSaved={() => {
              setModal(null);
              setToast({ type: 'success', message: 'Registro salvo com sucesso.' });
              navigate(resourceListPath(resource), { replace: true });
              void load();
            }}
          />
        )
      )}
      {pendingDelete && (
        <ConfirmModal
          title={resource.path === 'caminhoes' ? 'Excluir cavalo mecânico' : 'Excluir registro'}
          message="Esta ação não pode ser desfeita. Confirma a exclusão?"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove(pendingDelete)}
        />
      )}
      {consumoCavalo && <ConsumoModal cavalo={consumoCavalo} canWrite={canWrite} onClose={() => setConsumoCavalo(null)} />}
      {historicoItem && <HistoricoOperacionalModal resource={resource} item={historicoItem} onClose={() => setHistoricoItem(null)} />}
    </section>
  );
}

const implementoFields: Field[] = [
  { name: 'id', label: 'ID', hidden: true },
  { name: 'placa', label: 'Placa', mask: maskPlate },
  { name: 'tipo', label: 'Tipo', type: 'select', required: true, options: tiposImplemento },
  { name: 'carroceria', label: 'Carroceria', type: 'select', required: true, options: carrocerias },
  { name: 'quantidadeEixos', label: 'Eixos', type: 'select', required: true, options: [{ label: '2 eixos', value: '2' }, { label: '3 eixos', value: '3' }] },
  { name: 'capacidadeCarga', label: 'Capacidade', type: 'number' },
  { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Ativo', value: 'ATIVO' }, { label: 'Inativo', value: 'INATIVO' }, { label: 'Manutenção', value: 'MANUTENCAO' }] },
  { name: 'observacoes', label: 'Observações', type: 'textarea' },
];

async function loadRelationRows(field: Field) {
  if (!field.relation) return [];

  const rows: any[] = [];
  let page = 1;
  let total = 0;

  do {
    const { data } = await api.get(field.relation.endpoint, {
      params: { page, limit: relationPageLimit, ...field.relation.params },
    });
    const pageRows = Array.isArray(data.data) ? data.data : [];
    rows.push(...pageRows);
    total = Number(data.total || rows.length);
    if (!pageRows.length) break;
    page += 1;
  } while (rows.length < total);

  return rows;
}

function FragmentRows({ group, grouped, tableFields, resource, canWrite, onConsumo, onHistorico, onView, onEdit, onDelete }: {
  group: { key: string; title: string; rows: any[] };
  grouped: boolean;
  tableFields: Field[];
  resource: Resource;
  canWrite: boolean;
  onConsumo: (row: any) => void;
  onHistorico: (row: any) => void;
  onView: (row: any) => void;
  onEdit: (row: any) => void;
  onDelete: (row: any) => void;
}) {
  return (
    <>
      {grouped && (
        <tr className="status-group-row">
          <td colSpan={tableFields.length + 1}>
            <strong>{group.title}</strong>
            <span>{group.rows.length} registros</span>
          </td>
        </tr>
      )}
      {group.rows.map((row) => (
        <tr key={row.id}>
          {tableFields.map((field) => <td key={field.name}>{renderRowValue(row, field, resource)}</td>)}
          <td className="actions">
            {resource.path === 'caminhoes' && <button className="icon-button" title="Consumo e média" onClick={() => onConsumo(row)}><Fuel size={17} /></button>}
            {['caminhoes', 'motoristas'].includes(resource.path) && <button className="icon-button" title="Histórico" onClick={() => onHistorico(row)}><History size={17} /></button>}
            <button className="icon-button" title="Visualizar" onClick={() => onView(row)}><Eye size={17} /></button>
            {row.faturamentoOrigemId && <span className="generated-expense-label" title="Gerada automaticamente pelo faturamento de origem">Automática</span>}
            {canWrite && !row.protegido && !row.faturamentoOrigemId && <button className="icon-button" title="Editar" onClick={() => onEdit(row)}><Pencil size={17} /></button>}
            {canWrite && !row.protegido && !row.faturamentoOrigemId && <button className="icon-button danger" title={resource.path === 'caminhoes' ? 'Excluir cavalo mecânico' : 'Excluir'} onClick={() => onDelete(row)}><Trash2 size={17} /></button>}
          </td>
        </tr>
      ))}
    </>
  );
}

type TimelineEvent = { id: string; when: string; kind: string; title: string; description: string; amount?: number };

function HistoricoOperacionalModal({ resource, item, onClose }: { resource: Resource; item: any; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const isCavalo = resource.path === 'caminhoes';

  useEffect(() => {
    api.get(`${resource.endpoint}/${item.id}/historico`)
      .then((response) => setData(response.data))
      .catch(async (requestError) => setError(await apiErrorMessage(requestError, 'Não foi possível carregar o histórico.')));
  }, [resource.endpoint, item.id]);

  const events = useMemo(() => data ? buildTimeline(data, isCavalo) : [], [data, isCavalo]);
  const title = isCavalo ? [item.placa, item.marca, item.modelo].filter(Boolean).join(' - ') : [item.nome, item.cpf].filter(Boolean).join(' - ');

  return <div className="modal-backdrop">
    <div className="modal large-modal historico-modal">
      <div className="modal-header"><div><h2>Histórico {isCavalo ? 'do cavalo' : 'do motorista'}</h2><span>{title}</span></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div>
      {data && <div className="historico-stats">
        <HistoricoStat label="Eventos" value={String(events.length)} />
        <HistoricoStat label="Despesas" value={money(data.totais?.totalDespesas || 0)} />
        <HistoricoStat label="Faturamento" value={money(data.totais?.totalFaturamento || 0)} />
        <HistoricoStat label="Saldo" value={money(data.totais?.saldo || 0)} />
      </div>}
      {error && <div className="form-error">{error}</div>}
      {!data && !error && <div className="empty-inline">Carregando histórico...</div>}
      {data && <>
        <div className="historico-current"><strong>Situação atual</strong><span>{isCavalo ? `${data.conjuntosAtuais?.length || 0} composição(ões) registrada(s)` : `${data.cavalosAtuais?.length || 0} cavalo(s) atualmente vinculado(s)`}</span></div>
        <div className="section-title"><h3>Linha do tempo</h3><span>Mais recentes primeiro</span></div>
        <div className="timeline">
          {events.map((event) => <article className="timeline-event" key={`${event.kind}-${event.id}`}><div className="timeline-marker" /><div className="timeline-content"><div className="timeline-heading"><strong>{event.title}</strong><time>{dateTime(event.when)}</time></div><span className="timeline-kind">{event.kind}</span><p>{event.description}</p>{event.amount !== undefined && <b>{money(event.amount)}</b>}</div></article>)}
          {!events.length && <div className="empty-inline">Ainda não há eventos históricos para este cadastro.</div>}
        </div>
      </>}
    </div>
  </div>;
}

function buildTimeline(data: any, isCavalo: boolean): TimelineEvent[] {
  const motoristas = new Map((data.motoristasHistoricos || []).map((motorista: any) => [motorista.id, motorista.nome]));
  const alteracoes = (data.alteracoes || []).map((registro: any) => {
    const antes = registro.dadosAntes || {};
    const depois = registro.dadosDepois || {};
    let description = registro.observacoes || historyAction(registro.acao);
    if (isCavalo && antes.motoristaId !== depois.motoristaId) {
      const anterior = motoristas.get(antes.motoristaId) || (antes.motoristaId ? 'Motorista anterior' : 'Sem motorista');
      const atual = motoristas.get(depois.motoristaId) || (depois.motoristaId ? 'Novo motorista' : 'Sem motorista');
      description = `Motorista alterado de ${anterior} para ${atual}.`;
    }
    return { id: registro.id, when: registro.createdAt, kind: 'Cadastro e vínculo', title: historyAction(registro.acao), description };
  });
  const vinculos = (isCavalo ? data.historicoEngates || [] : data.historicoCavalos || []).map((registro: any) => ({
    id: registro.id,
    when: registro.createdAt,
    kind: isCavalo ? 'Composição' : 'Vínculo com cavalo',
    title: historyAction(registro.acao),
    description: historyRelationDescription(registro, isCavalo),
  }));
  const financeiros = (data.lancamentos || []).map((registro: any) => {
    const party = registro.tipoLancamento === 'DESPESA' ? registro.fornecedor?.nome : registro.cliente?.nome;
    const relation = isCavalo ? registro.motorista?.nome : registro.cavaloMecanico?.placa;
    return {
      id: registro.id,
      when: registro.data,
      kind: 'Financeiro',
      title: registro.tipoLancamento === 'DESPESA' ? 'Despesa' : 'Faturamento',
      description: [registro.descricao, registro.categoriaFinanceira?.nome, party, relation && `${isCavalo ? 'Motorista' : 'Cavalo'}: ${relation}`].filter(Boolean).join(' • ') || 'Lançamento financeiro',
      amount: Number(registro.valorTotal || 0),
    };
  });
  return [...alteracoes, ...vinculos, ...financeiros].sort((left, right) => new Date(right.when).getTime() - new Date(left.when).getTime());
}

function historyAction(action: string) {
  const labels: Record<string, string> = { ATUALIZACAO: 'Cadastro atualizado', VINCULO_CAVALO: 'Motorista vinculado', REMOCAO_CAVALO: 'Motorista removido', CRIACAO_COM_CONJUNTO: 'Cavalo e composição cadastrados', ATUALIZACAO_COMPOSICAO: 'Composição atualizada', ENGATE_CONJUNTO: 'Conjunto engatado', DESENGATE_CONJUNTO: 'Conjunto desengatado', ATUALIZACAO_ENGATE: 'Engate atualizado', CRIACAO_COMPOSICAO: 'Composição criada' };
  return labels[action] || String(action || 'Evento').replace(/_/g, ' ').toLowerCase().replace(/^./, (letter: string) => letter.toUpperCase());
}

function historyRelationDescription(registro: any, isCavalo: boolean) {
  const snapshot = registro.dadosDepois || registro.dadosAntes || {};
  if (isCavalo) return [snapshot.nome, snapshot.tipo, snapshot.quantidadeTotalEixos != null ? `${snapshot.quantidadeTotalEixos} eixos` : null].filter(Boolean).join(' • ') || registro.observacoes || 'Alteração na composição do cavalo.';
  return [snapshot.placa, snapshot.marca, snapshot.modelo].filter(Boolean).join(' • ') || registro.observacoes || 'Alteração no vínculo do motorista com o cavalo.';
}

function HistoricoStat({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function dateTime(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString('pt-BR'); }

type ConsumoForm = { id?: string; data: string; kmAnterior: string; kmAtual: string; litros: string; observacoes: string };

function ConsumoModal({ cavalo, canWrite, onClose }: { cavalo: any; canWrite: boolean; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<ConsumoForm>(() => emptyConsumoForm());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);

  async function load(reset = false) {
    setLoading(true);
    try {
      const response = await api.get('/abastecimentos', { params: { cavaloMecanicoId: cavalo.id } });
      setData(response.data);
      if (reset || !form.id) setForm({ ...emptyConsumoForm(), kmAnterior: response.data.resumo.kmAnteriorSugerido?.toString() || '' });
      setError('');
    } catch (requestError) {
      setError(await apiErrorMessage(requestError, 'Não foi possível carregar o histórico de consumo.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); }, [cavalo.id]);

  const distancia = Number(form.kmAtual) - Number(form.kmAnterior);
  const media = distancia > 0 && Number(form.litros) > 0 ? distancia / Number(form.litros) : 0;
  const sugestao = data?.resumo?.kmAnteriorSugerido;
  const alterouSugestao = !form.id && sugestao != null && form.kmAnterior !== '' && Number(form.kmAnterior) !== Number(sugestao);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = { cavaloMecanicoId: cavalo.id, data: form.data, kmAnterior: Number(form.kmAnterior), kmAtual: Number(form.kmAtual), litros: Number(form.litros), observacoes: form.observacoes || null };
      if (form.id) await api.patch(`/abastecimentos/${form.id}`, payload);
      else await api.post('/abastecimentos', payload);
      await load(true);
    } catch (requestError) {
      setError(await apiErrorMessage(requestError, 'Não foi possível salvar o registro de consumo.'));
    }
  }

  async function remove() {
    try {
      await api.delete(`/abastecimentos/${pendingDelete.id}`);
      setPendingDelete(null);
      await load(true);
    } catch (requestError) {
      setError(await apiErrorMessage(requestError, 'Não foi possível excluir o registro de consumo.'));
    }
  }

  function edit(item: any) {
    setForm({ id: item.id, data: String(item.data).slice(0, 10), kmAnterior: String(item.kmAnterior), kmAtual: String(item.kmAtual), litros: String(item.litros), observacoes: item.observacoes || '' });
    setError('');
  }

  return (
    <div className="modal-backdrop">
      <div className="modal large-modal consumo-modal">
        <div className="modal-header">
          <div><h2>Consumo do veículo</h2><span>{[cavalo.placa, cavalo.marca, cavalo.modelo].filter(Boolean).join(' - ')}</span></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        {data && <div className="consumo-stats"><ConsumoStat label="Média geral" value={`${decimal(data.resumo.mediaGeralKmLitro, 3)} km/l`} /><ConsumoStat label="Distância total" value={`${decimal(data.resumo.distanciaTotal, 1)} km`} /><ConsumoStat label="Litros registrados" value={`${decimal(data.resumo.litrosTotal, 3)} L`} /><ConsumoStat label="Última quilometragem" value={data.resumo.ultimaQuilometragem == null ? '-' : `${decimal(data.resumo.ultimaQuilometragem, 1)} km`} /></div>}
        {canWrite && <form className="consumo-form" onSubmit={submit}>
          <div className="section-title"><h3>{form.id ? 'Editar registro' : 'Novo registro'}</h3>{form.id && <button type="button" className="button ghost" onClick={() => load(true)}>Cancelar edição</button>}</div>
          <div className="form-grid">
            <label>Data<input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></label>
            <label>Km anterior<input type="number" min="0" step="0.1" required value={form.kmAnterior} onChange={(e) => setForm({ ...form, kmAnterior: e.target.value })} /></label>
            <label>Km atual<input type="number" min="0" step="0.1" required value={form.kmAtual} onChange={(e) => setForm({ ...form, kmAtual: e.target.value })} /></label>
            <label>Litros<input type="number" min="0.001" step="0.001" required value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} /></label>
            <label className="wide">Observações<textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></label>
          </div>
          {alterouSugestao && <div className="form-warning">A quilometragem anterior foi alterada e não corresponde ao último registro deste veículo.</div>}
          <div className="consumo-preview"><span>Distância: <strong>{distancia > 0 ? `${decimal(distancia, 1)} km` : '-'}</strong></span><span>Média: <strong>{media > 0 ? `${decimal(media, 3)} km/l` : '-'}</strong></span></div>
          <div className="modal-actions"><button className="button primary">{form.id ? 'Salvar alterações' : 'Registrar consumo'}</button></div>
        </form>}
        {error && <div className="form-error">{error}</div>}
        <div className="section-title"><h3>Histórico</h3><span>{data?.resumo?.quantidadeRegistros || 0} registros</span></div>
        <div className="table-wrap consumo-history"><table><thead><tr><th>Data</th><th>Km anterior</th><th>Km atual</th><th>Distância</th><th>Litros</th><th>Média</th>{canWrite && <th>Ações</th>}</tr></thead><tbody>
          {data?.registros?.map((item: any) => <tr key={item.id} className={data.divergencias?.includes(item.id) ? 'consumo-divergente' : ''}><td>{date(item.data)}{data.divergencias?.includes(item.id) && <small title="A sequência de quilometragens não coincide com o registro anterior ou seguinte.">Sequência divergente</small>}</td><td>{decimal(item.kmAnterior, 1)}</td><td>{decimal(item.kmAtual, 1)}</td><td>{decimal(item.distanciaPercorrida, 1)} km</td><td>{decimal(item.litros, 3)} L</td><td><strong>{decimal(item.mediaKmLitro, 3)} km/l</strong></td>{canWrite && <td className="actions"><button className="icon-button" title="Editar" onClick={() => edit(item)}><Pencil size={16} /></button><button className="icon-button danger" title="Excluir" onClick={() => setPendingDelete(item)}><Trash2 size={16} /></button></td>}</tr>)}
          {!loading && !data?.registros?.length && <tr><td colSpan={canWrite ? 7 : 6}>Nenhum consumo registrado.</td></tr>}{loading && <tr><td colSpan={canWrite ? 7 : 6}>Carregando...</td></tr>}
        </tbody></table></div>
      </div>
      {pendingDelete && <ConfirmModal title="Excluir registro de consumo" message="A exclusão pode interromper a sequência de quilometragens. Confirma?" onCancel={() => setPendingDelete(null)} onConfirm={remove} />}
    </div>
  );
}

function ConsumoStat({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function emptyConsumoForm(): ConsumoForm { return { data: new Date().toISOString().slice(0, 10), kmAnterior: '', kmAtual: '', litros: '', observacoes: '' }; }
function decimal(value: any, digits: number) { const number = Number(value); return Number.isFinite(number) ? number.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '-'; }

function CaminhaoCompletoModal({ resource, mode, item, onClose, onSaved }: { resource: Resource; mode: Exclude<Mode, 'view'>; item: any; onClose: () => void; onSaved: (saved?: any) => void }) {
  const cavaloFields = resource.fields;
  const [form, setForm] = useState<any>(() => ({ ...prepareInitial(item, cavaloFields), status: item.status || 'ATIVO' }));
  const [implementos, setImplementos] = useState<any[]>(() => compositionImplementos(item));
  const [relationOptions, setRelationOptions] = useState<Record<string, { label: string; value: string }[]>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    const fields = cavaloFields.filter((field) => field.relation);
    Promise.all(
      fields.map(async (field) => {
        const rows = await loadRelationRows(field);
        return [
          field.name,
          rows.map((row: any) => ({
            value: row[field.relation?.valueKey || 'id'],
            label: relationLabel(row, field),
          })),
        ] as const;
      }),
    )
      .then((entries) => setRelationOptions(Object.fromEntries(entries)))
      .catch(() => setError('Não foi possível carregar as opções de relacionamento.'));
  }, [cavaloFields]);

  function update(field: Field, value: string | boolean) {
    const next = typeof value === 'string' && field.mask ? field.mask(value) : value;
    setForm((current: any) => ({ ...current, [field.name]: next }));
  }

  function updateImplemento(index: number, field: Field, value: string) {
    const next = field.mask ? field.mask(value) : value;
    setImplementos((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const updated = { ...item, [field.name]: next };
      if (item.tipo === 'DOLLY' && field.name === 'quantidadeEixos') {
        updated.quantidadeEixos = 2;
      }
      if (field.name === 'tipo' && next === 'DOLLY') {
        updated.quantidadeEixos = 2;
        updated.carroceria = 'OUTRO';
      }
      if (field.name === 'tipo' && next !== 'DOLLY' && Number(updated.quantidadeEixos) !== 2 && Number(updated.quantidadeEixos) !== 3) {
        updated.quantidadeEixos = 2;
      }
      return updated;
    }));
  }

  function addImplemento() {
    setImplementos((current) => [...current, { tipo: 'CARRETA', carroceria: 'OUTRO', quantidadeEixos: 2, capacidadeCarga: 0, status: 'ATIVO' }]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateComposicao(form, implementos);
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload = {
      ...sanitize(form, cavaloFields, 'create'),
      implementos: implementos.map((item) => sanitize(item, implementoFields, 'create')),
    };

    try {
      const response = mode === 'create'
        ? await api.post(resource.endpoint, payload)
        : await api.patch(`${resource.endpoint}/${item.id}/composicao`, payload);
      onSaved(response.data);
    } catch (requestError: any) {
      const message = await apiErrorMessage(requestError, 'Verifique os campos e tente novamente.');
      setError(message === 'Internal server error' ? 'Não foi possível salvar a composição. Verifique placas duplicadas e tente novamente.' : message);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal large-modal" onSubmit={submit}>
        <div className="modal-header">
          <h2>{mode === 'create' ? 'Novo cavalo mecânico' : 'Editar cavalo mecânico'}</h2>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-section">
          <div className="section-title">
            <h3>Cavalo mecânico</h3>
          </div>
          <div className="form-grid">
            {cavaloFields.filter((field) => shouldRenderField(field, form)).map((field) => (
              <FieldControl
                key={field.name}
                field={field}
                value={form[field.name]}
                relationOptions={relationOptions}
                onChange={(value) => update(field, value)}
              />
            ))}
          </div>
        </div>
        <div className="form-section">
          <div className="section-title">
            <h3>Implementos</h3>
            <button type="button" className="button" onClick={addImplemento}><Plus size={16} /> Adicionar</button>
          </div>
          <CompositionSummary cavalo={form} implementos={implementos} />
          <CompositionDrawing cavalo={form} implementos={implementos} />
          {!implementos.length && <div className="empty-inline">Sem carreta, dolly ou reboque vinculado neste cadastro.</div>}
          <div className="implemento-list">
            {implementos.map((implemento, index) => (
              <div className="implemento-item" key={index}>
                <div className="section-title compact">
                  <strong>Implemento {index + 1}</strong>
                  <button type="button" className="icon-button danger" title="Remover" onClick={() => setImplementos((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="form-grid">
                  {implementoFields.filter((field) => shouldRenderImplementoField(field, implemento)).map((field) => (
                    <FieldControl
                      key={field.name}
                      field={field}
                      value={implemento[field.name]}
                      onChange={(value) => updateImplemento(index, field, String(value))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button ghost" onClick={onClose}>Cancelar</button>
          <button className="button primary">Salvar tudo</button>
        </div>
      </form>
    </div>
  );
}

function FieldControl({ field, value, relationOptions = {}, onChange }: { field: Field; value: any; relationOptions?: Record<string, { label: string; value: string }[]>; onChange: (value: string | boolean) => void }) {
  return (
    <label className={field.type === 'textarea' ? 'wide' : ''}>
      {field.label}
      {field.type === 'select' ? (
        <SearchableSelect
          value={value || ''}
          options={field.relation ? relationOptions[field.name] : field.options}
          required={field.required}
          ariaLabel={field.label}
          onChange={onChange}
        />
      ) : field.type === 'textarea' ? (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === 'checkbox' ? (
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
      ) : (
        <input type={field.type === 'money' ? 'number' : field.type || 'text'} step={field.type === 'money' ? '0.01' : undefined} value={value ?? ''} required={field.required} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function CompositionDrawing({ cavalo, implementos }: { cavalo: any; implementos: any[] }) {
  return (
    <div className="composition-drawing" aria-label="Desenho da composição">
      <VehicleSketch type="CAVALO" label={cavalo.placa || 'Cavalo'} />
      {implementos.map((item, index) => (
        <VehicleSketch
          key={`${item.id || item.placa || item.tipo}-${index}`}
          type={item.tipo === 'DOLLY' ? 'DOLLY' : 'CARRETA'}
          label={[item.tipo, item.placa].filter(Boolean).join(' ') || `Implemento ${index + 1}`}
        />
      ))}
    </div>
  );
}

function SelectedCavaloComposition({ cavalo }: { cavalo: any }) {
  const implementos = compositionImplementos(cavalo);
  return (
    <div className="selected-composition">
      <CompositionSummary cavalo={cavalo} implementos={implementos} />
      <CompositionDrawing cavalo={cavalo} implementos={implementos} />
      <span>{compositionSummary(implementos)}</span>
    </div>
  );
}

function CompositionSummary({ cavalo, implementos }: { cavalo: any; implementos: any[] }) {
  const totalEixos = calculateTotalEixos(cavalo, implementos);
  return (
    <div className="composition-summary">
      <strong>Total de eixos: {totalEixos || '-'}</strong>
      <span>Tipo do conjunto: {conjuntoTipoLabel(totalEixos)}</span>
    </div>
  );
}

function VehicleSketch({ type, label }: { type: 'CAVALO' | 'CARRETA' | 'DOLLY'; label: string }) {
  const isDolly = type === 'DOLLY';
  const width = type === 'CAVALO' ? 116 : isDolly ? 74 : 132;
  const viewBox = `0 0 ${width} 66`;

  return (
    <div className={`vehicle-sketch ${type.toLowerCase()}-sketch`}>
      {type !== 'CAVALO' && <div className="vehicle-hitch" />}
      <svg viewBox={viewBox} role="img" aria-hidden="true">
        {type === 'CAVALO' ? (
          <>
            <path className="vehicle-fill accent" d="M12 32h38l8-17h22c10 0 18 8 18 18v11h-8a12 12 0 0 0-24 0H43a12 12 0 0 0-24 0h-7V32Z" />
            <path className="vehicle-window" d="M61 20h15c7 0 13 5 15 12H55l6-12Z" />
            <path className="vehicle-line" d="M12 32h38l8-17h22c10 0 18 8 18 18v11h-8M43 44h23M19 44h-7V32" />
            <circle className="vehicle-wheel" cx="31" cy="44" r="8" />
            <circle className="vehicle-wheel" cx="78" cy="44" r="8" />
            <path className="vehicle-line" d="M98 38h14" />
          </>
        ) : isDolly ? (
          <>
            <path className="vehicle-fill dolly-fill" d="M18 30h38v10H18V30Z" />
            <path className="vehicle-line" d="M6 35h12M56 35h12M18 30h38v10H18V30Z" />
            <circle className="vehicle-wheel" cx="27" cy="45" r="7" />
            <circle className="vehicle-wheel" cx="48" cy="45" r="7" />
          </>
        ) : (
          <>
            <path className="vehicle-fill" d="M18 16h96v28H18V16Z" />
            <path className="vehicle-roof" d="M25 10h82l7 6H18l7-6Z" />
            <path className="vehicle-line" d="M6 36h12M18 16h96v28H18V16ZM25 10h82l7 6H18l7-6Z" />
            <path className="vehicle-line soft" d="M32 22h68M32 30h68" />
            <circle className="vehicle-wheel" cx="38" cy="45" r="8" />
            <circle className="vehicle-wheel" cx="94" cy="45" r="8" />
          </>
        )}
      </svg>
      <span>{label}</span>
    </div>
  );
}

function compositionImplementos(item: any) {
  const conjunto = item?.conjuntos?.[0];
  if (!conjunto?.implementos?.length) return [];
  return conjunto.implementos.map((vinculo: any) => ({
    ...vinculo.implemento,
    capacidadeCarga: vinculo.implemento?.capacidadeCarga ? Number(vinculo.implemento.capacidadeCarga) : 0,
  }));
}

function ConfirmModal({
  title,
  message,
  confirmLabel = 'Excluir',
  confirmClassName = 'danger',
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClassName?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const visibleMessage = title === 'Excluir cavalo mecânico'
    ? 'Esta ação remove o cavalo mecânico inteiro, não apenas a carreta. Para remover uma carreta ou dolly, edite o cavalo e altere a composição.'
    : message;

  return (
    <div className="modal-backdrop">
      <div className="modal small-modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onCancel}><X size={18} /></button>
        </div>
        <p>{visibleMessage}</p>
        <div className="modal-actions">
          <button type="button" className="button ghost" onClick={onCancel}>Cancelar</button>
          <button type="button" className={`button ${confirmClassName}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function RecordModal({ resource, mode, item, onClose, onSaved }: { resource: Resource; mode: Mode; item: any; onClose: () => void; onSaved: (saved?: any) => void }) {
  const [form, setForm] = useState<any>(() => ({ ...prepareInitial(item, resource.fields), ...resource.fixedValues }));
  const [relationOptions, setRelationOptions] = useState<Record<string, { label: string; value: string }[]>>({});
  const [relationRows, setRelationRows] = useState<Record<string, any[]>>({});
  const [quickCreate, setQuickCreate] = useState<{ field: Field; resource: Resource } | null>(null);
  const [showCommissionDetails, setShowCommissionDetails] = useState(false);
  const [pendingNoCommissionPayload, setPendingNoCommissionPayload] = useState<any | null>(null);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const readonly = mode === 'view';
  const selectedCavalo = relationRows.cavaloMecanicoId?.find((row: any) => row.id === form.cavaloMecanicoId);
  const changedCavalo = mode === 'edit' && item.cavaloMecanicoId && item.cavaloMecanicoId !== form.cavaloMecanicoId;
  const selectedAxles = resource.path === 'faturamento'
    ? Number(
      !changedCavalo && item.quantidadeEixosComissao != null
        ? item.quantidadeEixosComissao
        : !changedCavalo && item.conjunto?.quantidadeTotalEixos != null
          ? item.conjunto.quantidadeTotalEixos
          : selectedCavalo
            ? selectedCavalo.conjuntos?.[0]?.quantidadeTotalEixos ?? calculateTotalEixos(selectedCavalo, compositionImplementos(selectedCavalo))
            : 0,
    )
    : 0;

  async function loadRelations() {
    const fields = resource.fields.filter((field) => field.relation);
    if (!fields.length) return;

    await Promise.all(
      fields.map(async (field) => {
        const rows = await loadRelationRows(field);
        const options = rows.map((row: any) => ({
          value: row[field.relation?.valueKey || 'id'],
          label: relationLabel(row, field),
        }));
        return [field.name, options, rows] as const;
      }),
    )
      .then((entries) => {
        setRelationOptions(Object.fromEntries(entries.map(([name, options]) => [name, options])));
        setRelationRows(Object.fromEntries(entries.map(([name, , rows]) => [name, rows])));
      })
      .catch(() => setError('Não foi possível carregar as opções de relacionamento.'));
  }

  useEffect(() => {
    loadRelations();
  }, [resource.fields]);

  function update(field: Field, value: string | boolean) {
    const next = typeof value === 'string' && field.mask ? field.mask(value) : value;
    if (field.name === 'cavaloMecanicoId') {
      setPendingNoCommissionPayload(null);
      setShowCommissionDetails(false);
    }
    setForm((current: any) => {
      const updated = { ...current, [field.name]: next };
      if (field.name === 'cavaloMecanicoId' && typeof next === 'string') {
        const cavalo = relationRows[field.name]?.find((row: any) => row.id === next);
        updated.motoristaId = cavalo?.motoristaId || '';
        if (current[field.name] !== next) {
          const eixos = cavalo
            ? Number(cavalo.conjuntos?.[0]?.quantidadeTotalEixos ?? calculateTotalEixos(cavalo, compositionImplementos(cavalo)))
            : 0;
          const defaults = commissionDefaults(eixos);
          updated.tipoComissao = '';
          updated.percentualComissao = defaults?.percentual ?? null;
          updated.valorComissaoPorViagem = defaults?.valorPorViagem ?? null;
        }
      }
      return updated;
    });
  }

  function updateCommission(name: string, value: string | number | null) {
    setForm((current: any) => ({ ...current, [name]: value }));
    setError('');
  }

  function updateMulti(field: Field, value: string) {
    setForm((current: any) => {
      const values = Array.isArray(current[field.name]) ? current[field.name] : [];
      return {
        ...current,
        [field.name]: values.includes(value) ? values.filter((item: string) => item !== value) : [...values, value],
      };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...sanitize(form, resource.fields, mode), ...resource.fixedValues };
    if (resource.path === 'faturamento') {
      const eligible = Boolean(commissionDefaults(selectedAxles));
      const legacyWithoutCommission = mode === 'edit' && !item.tipoComissao && !form.tipoComissao;
      if (eligible && !form.tipoComissao && !legacyWithoutCommission) {
        setError('Selecione o tipo de comissão antes de salvar o faturamento.');
        return;
      }
      if (eligible && form.tipoComissao) {
        const percentual = Number(form.percentualComissao);
        const valorPorViagem = Number(form.valorComissaoPorViagem);
        if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) {
          setError('Informe um percentual de comissão maior que zero e menor ou igual a 100%.');
          return;
        }
        if (!Number.isFinite(valorPorViagem) || valorPorViagem <= 0) {
          setError('Informe um valor de comissão por viagem maior que zero.');
          return;
        }
        payload.tipoComissao = form.tipoComissao;
        payload.percentualComissao = percentual;
        payload.valorComissaoPorViagem = valorPorViagem;
      } else {
        payload.tipoComissao = null;
        payload.percentualComissao = null;
        payload.valorComissaoPorViagem = null;
      }
      if (!eligible) {
        setPendingNoCommissionPayload(payload);
        return;
      }
    }
    await persist(payload);
  }

  async function persist(payload: any) {
    try {
      const response = mode === 'create'
        ? await api.post(resource.endpoint, payload)
        : await api.patch(`${resource.endpoint}/${item.id}`, payload);

      const changedOwnPassword =
        mode === 'edit' &&
        resource.path === 'users' &&
        item.id === user?.id &&
        Boolean(payload.senha);
      if (changedOwnPassword) {
        sessionStorage.setItem('authMessage', 'Senha alterada com sucesso. Entre novamente usando a nova senha.');
        logout();
        return;
      }

      onSaved(response?.data);
    } catch (requestError: any) {
      setError(await apiErrorMessage(requestError, 'Verifique os campos e tente novamente.'));
    }
  }


  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-header">
          <h2>{mode === 'create' ? 'Novo registro' : mode === 'edit' ? 'Editar registro' : 'Detalhes'}</h2>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-grid">
          {resource.fields.filter((field) => shouldRenderField(field, form)).map((field) => {
            return (
              <label key={field.name} className={field.type === 'textarea' ? 'wide' : ''}>
                {field.label}
                {field.type === 'select' ? (
                  <>
                    <div className="relation-control">
                      <SearchableSelect
                        disabled={readonly}
                        value={form[field.name] || ''}
                        options={field.relation ? relationOptions[field.name] : field.options}
                        required={isRequiredForMode(field, mode, readonly)}
                        ariaLabel={field.label}
                        onChange={(value) => update(field, value)}
                      />
                      {!readonly && field.relation && quickCreateResource(field) && (
                        <button type="button" className="button" onClick={() => setQuickCreate({ field, resource: quickCreateResource(field)! })}>
                          <Plus size={16} /> Cadastrar
                        </button>
                      )}
                    </div>
                    {field.name === 'cavaloMecanicoId' && selectedCavalo && <SelectedCavaloComposition cavalo={selectedCavalo} />}
                  </>
                ) : field.type === 'multiselect' ? (
                  <div className="multi-options">
                    {(field.relation ? relationOptions[field.name] : field.options)?.map((option) => (
                      <label key={option.value} className="check-row">
                        <input disabled={readonly} type="checkbox" checked={(form[field.name] || []).includes(option.value)} onChange={() => updateMulti(field, option.value)} />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                ) : field.type === 'textarea' ? (
                  <textarea disabled={readonly} value={form[field.name] || ''} onChange={(e) => update(field, e.target.value)} />
                ) : field.type === 'checkbox' ? (
                  <input disabled={readonly} type="checkbox" checked={Boolean(form[field.name])} onChange={(e) => update(field, e.target.checked)} />
                ) : (
                  <input disabled={readonly} type={field.type === 'money' ? 'number' : field.type || 'text'} step={field.type === 'money' ? '0.01' : undefined} value={form[field.name] || ''} required={isRequiredForMode(field, mode, readonly)} onChange={(e) => update(field, e.target.value)} />
                )}
              </label>
            );
          })}
        </div>
        {resource.path === 'faturamento' && (
          <CommissionSection
            mode={mode}
            form={form}
            eixos={selectedAxles}
            hasSelectedCavalo={Boolean(selectedCavalo || form.cavaloMecanicoId)}
            legacyWithoutCommission={mode === 'edit' && !item.tipoComissao}
            showDetails={showCommissionDetails}
            onToggleDetails={() => setShowCommissionDetails((current) => !current)}
            onChange={updateCommission}
          />
        )}
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button ghost" onClick={onClose}>Cancelar</button>
          {!readonly && <button className="button primary">Salvar</button>}
        </div>
      </form>
      {quickCreate && (
        <div className="nested-backdrop">
          {quickCreate.resource.path === 'caminhoes' ? (
            <CaminhaoCompletoModal
              resource={quickCreate.resource}
              mode="create"
              item={{}}
              onClose={() => setQuickCreate(null)}
              onSaved={async (saved) => {
                await loadRelations();
                setForm((current: any) => ({ ...current, [quickCreate.field.name]: saved?.id || current[quickCreate.field.name] }));
                setQuickCreate(null);
              }}
            />
          ) : (
            <RecordModal
              resource={quickCreate.resource}
              mode="create"
              item={{}}
              onClose={() => setQuickCreate(null)}
              onSaved={async (saved) => {
                await loadRelations();
                setForm((current: any) => ({ ...current, [quickCreate.field.name]: saved?.id || current[quickCreate.field.name] }));
                setQuickCreate(null);
              }}
            />
          )}
        </div>
      )}
      {pendingNoCommissionPayload && (
        <ConfirmModal
          title="Continuar sem comissão"
          message={`A composição selecionada possui ${selectedAxles || 'quantidade não identificada de'} eixos e não gera comissão. Deseja salvar o faturamento sem comissão?`}
          confirmLabel="Continuar"
          confirmClassName="primary"
          onCancel={() => setPendingNoCommissionPayload(null)}
          onConfirm={() => {
            const payload = pendingNoCommissionPayload;
            setPendingNoCommissionPayload(null);
            void persist(payload);
          }}
        />
      )}
    </div>
  );
}

function CommissionSection({
  mode,
  form,
  eixos,
  hasSelectedCavalo,
  legacyWithoutCommission,
  showDetails,
  onToggleDetails,
  onChange,
}: {
  mode: Mode;
  form: any;
  eixos: number;
  hasSelectedCavalo: boolean;
  legacyWithoutCommission: boolean;
  showDetails: boolean;
  onToggleDetails: () => void;
  onChange: (name: string, value: string | number | null) => void;
}) {
  const readonly = mode === 'view';
  const defaults = commissionDefaults(eixos);
  const total = billingTotal(form.quantidade, form.valorUnitario, form.multiplicarQuantidade);
  const values = commissionValues(total, form.percentualComissao, form.valorComissaoPorViagem);
  const selectedValue = selectedCommissionValue(form.tipoComissao, values);
  const afterCommission = total - selectedValue;

  function selectType(value: string) {
    if (value && defaults) {
      if (!Number(form.percentualComissao)) onChange('percentualComissao', defaults.percentual);
      if (!Number(form.valorComissaoPorViagem)) onChange('valorComissaoPorViagem', defaults.valorPorViagem);
    }
    onChange('tipoComissao', value);
  }

  function restoreDefaults() {
    if (!defaults) return;
    onChange('percentualComissao', defaults.percentual);
    onChange('valorComissaoPorViagem', defaults.valorPorViagem);
  }

  if (!hasSelectedCavalo) {
    return <div className="commission-section commission-empty">Selecione o cavalo mecânico completo para verificar a regra de comissão.</div>;
  }

  if (!defaults) {
    return (
      <div className="commission-section">
        <div className="commission-heading">
          <div><strong>Comissão</strong><span>Composição com {eixos || 'quantidade não identificada de'} eixos</span></div>
        </div>
        <div className="form-warning">Esta composição não possui 4, 7 ou 9 eixos e não gera comissão. O sistema solicitará confirmação antes de salvar.</div>
        <div className="commission-summary">
          <div><span>Faturamento bruto</span><strong>{money(total)}</strong></div>
          <div><span>Comissão</span><strong>{money(0)}</strong></div>
          <div><span>Após comissão</span><strong>{money(total)}</strong></div>
        </div>
      </div>
    );
  }

  return (
    <div className="commission-section">
      <div className="commission-heading">
        <div>
          <strong>Comissão</strong>
          <span>Regra para composição de {eixos} eixos</span>
        </div>
        <button type="button" className={`icon-button ${showDetails ? 'active' : ''}`} title="Visualizar e alterar os valores da comissão" aria-label="Visualizar e alterar os valores da comissão" onClick={onToggleDetails}>
          <Eye size={18} />
        </button>
      </div>

      {legacyWithoutCommission && !form.tipoComissao && (
        <div className="form-warning">Este faturamento foi criado antes da comissão e continuará sem comissão, a menos que você escolha um tipo agora.</div>
      )}

      <label>
        Tipo de comissão
        <SearchableSelect
          value={form.tipoComissao || ''}
          options={[
            { value: 'PERCENTUAL', label: 'Percentual' },
            { value: 'POR_VIAGEM', label: 'Por viagem' },
          ]}
          emptyLabel={legacyWithoutCommission ? 'Sem comissão registrada' : 'Selecione'}
          disabled={readonly}
          required={mode === 'create'}
          ariaLabel="Tipo de comissão"
          onChange={selectType}
        />
      </label>

      {showDetails && (
        <div className="commission-details">
          <div className="commission-rule-grid">
            <label>
              Percentual (%)
              <input disabled={readonly} type="number" min="0.01" max="100" step="0.01" value={form.percentualComissao ?? ''} onChange={(event) => onChange('percentualComissao', event.target.value)} />
              <small>{form.percentualComissao || 0}% de {money(total)} = {money(values.percentual)}</small>
            </label>
            <label>
              Valor por viagem
              <input disabled={readonly} type="number" min="0.01" step="0.01" value={form.valorComissaoPorViagem ?? ''} onChange={(event) => onChange('valorComissaoPorViagem', event.target.value)} />
              <small>Uma viagem = {money(values.porViagem)}</small>
            </label>
          </div>
          {!readonly && <button type="button" className="button ghost" onClick={restoreDefaults}>Restaurar valores padrão</button>}
        </div>
      )}

      <div className="commission-summary">
        <div><span>Faturamento bruto</span><strong>{money(total)}</strong></div>
        <div><span>Comissão calculada</span><strong>{form.tipoComissao ? money(selectedValue) : '-'}</strong></div>
        <div><span>Após comissão</span><strong>{form.tipoComissao ? money(afterCommission) : money(total)}</strong></div>
      </div>
    </div>
  );
}

function renderValue(value: any, field: Field) {
  if (field.relation?.objectKey && value === undefined) return '-';
  if (field.type === 'money') return money(value);
  if (field.type === 'date') return date(value);
  if (field.type === 'checkbox') return value ? 'Sim' : 'Não';
  if (field.options?.length) return field.options.find((option) => option.value === value)?.label || value || '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return value || '-';
}

function groupRowsByOperationalStatus(resource: Resource, rows: any[]) {
  if (!['caminhoes', 'motoristas'].includes(resource.path)) {
    return [{ key: 'all', title: resource.title, rows }];
  }
  if (!rows.length) return [{ key: 'all', title: resource.title, rows }];

  const labels: Record<string, string> = {
    ATIVO: 'Ativos',
    MANUTENCAO: 'Em manutenção',
    INATIVO: 'Inativos',
    SEM_STATUS: 'Sem status',
  };
  const order = ['ATIVO', 'MANUTENCAO', 'INATIVO', 'SEM_STATUS'];
  return order
    .map((status) => ({
      key: status,
      title: labels[status],
      rows: rows.filter((row) => (row.status || 'SEM_STATUS') === status),
    }))
    .filter((group) => group.rows.length > 0);
}

function renderRowValue(row: any, field: Field, resource?: Resource) {
  if (resource?.path === 'caminhoes' && field.name === 'composicaoAtual') {
    const implementos = compositionImplementos(row);
    return (
      <div className="composition-cell">
        <CompositionDrawing cavalo={row} implementos={implementos} />
        <span>{compositionSummary(implementos)}</span>
      </div>
    );
  }
  if (resource?.path === 'caminhoes' && field.name === 'motoristaId' && !row.motorista) {
    return <span className="status-warning">Sem motorista vinculado</span>;
  }
  if (field.relation?.objectKey && row[field.relation.objectKey]) {
    return relationLabel(row[field.relation.objectKey], field);
  }
  return renderValue(row[field.name], field);
}

function relationLabel(row: any, field: Field) {
  const primary = row[field.relation?.labelKey || 'nome'];
  const secondary = field.relation?.fallbackKey ? row[field.relation.fallbackKey] : undefined;
  return [primary, secondary].filter(Boolean).join(' - ') || row.id;
}

function quickCreateResource(field: Field) {
  if (!field.relation) return undefined;
  return crudResources.find((resource) => resource.endpoint === field.relation?.endpoint && !resource.readOnly);
}

function compositionSummary(implementos: any[]) {
  if (!implementos.length) return 'Sem implementos';
  return implementos.map((item) => [item.tipo, item.placa].filter(Boolean).join(' ')).join(' + ');
}

function shouldRenderImplementoField(field: Field, implemento: any) {
  if (!shouldRenderField(field, implemento)) return false;
  return !(implemento.tipo === 'DOLLY' && field.name === 'carroceria');
}

function calculateTotalEixos(cavalo: any, implementos: any[]) {
  return cavaloEixos(cavalo?.tipoCavalo) + implementos.reduce((total, item) => total + implementoEixos(item), 0);
}

function cavaloEixos(tipoCavalo?: string | null) {
  if (tipoCavalo === 'SIMPLES_TOCO_4X2') return 2;
  if (tipoCavalo === 'TRUCADO_6X2' || tipoCavalo === 'TRACADO_6X4') return 3;
  return 0;
}

function implementoEixos(implemento: any) {
  if (implemento.tipo === 'DOLLY') return 2;
  const eixos = Number(implemento.quantidadeEixos || 0);
  return eixos === 2 || eixos === 3 ? eixos : 0;
}

function conjuntoTipoLabel(totalEixos: number) {
  if (totalEixos === 5) return 'Carreta simples';
  if (totalEixos === 6) return 'Carreta LS';
  if (totalEixos === 7) return 'Bitrem';
  if (totalEixos === 9) return 'Rodotrem';
  if (totalEixos === 11) return 'Rodotrem 11 eixos';
  return 'A definir';
}

function validateComposicao(cavalo: any, implementos: any[]) {
  if (!implementos.length) return '';
  if (!cavalo.tipoCavalo) return 'Informe o tipo do cavalo para calcular o total de eixos.';

  const carretas = implementos.filter((item) => item.tipo !== 'DOLLY');
  const dollys = implementos.filter((item) => item.tipo === 'DOLLY');

  if (carretas.length > 2) return 'A composição deve ter no máximo duas carretas/reboques.';
  if (dollys.length > 1) return 'A composição deve ter no máximo um dolly.';
  if (dollys.length && carretas.length === 1) return 'Se houver apenas uma carreta, não informe dolly.';
  if (dollys.length && (implementos.length !== 3 || implementos[1]?.tipo !== 'DOLLY')) return 'No rodotrem, informe os implementos na ordem: 1ª carreta, dolly e 2ª carreta.';
  if (dollys.length && cavaloEixos(cavalo.tipoCavalo) < 3) return 'Rodotrem deve usar cavalo trucado ou traçado.';
  if (carretas.some((item) => ![2, 3].includes(Number(item.quantidadeEixos)))) return 'Carretas devem ter 2 ou 3 eixos.';
  return '';
}

function prepareInitial(item: any, fields: Field[]) {
  const initial = { ...item };
  for (const field of fields) {
    if (field.type === 'date' && initial[field.name]) initial[field.name] = String(initial[field.name]).slice(0, 10);
    if (field.type === 'multiselect' && initial[field.name] === undefined && Array.isArray(initial.implementos)) {
      initial[field.name] = initial.implementos.map((item: any) => item.implementoId || item.implemento?.id).filter(Boolean);
    }
    if (field.type === 'multiselect' && initial[field.name] === undefined) initial[field.name] = [];
    if (field.type === 'checkbox' && field.required && initial[field.name] === undefined) initial[field.name] = true;
    if (field.type === 'textarea' && typeof initial[field.name] === 'object' && initial[field.name] !== null) {
      initial[field.name] = JSON.stringify(initial[field.name], null, 2);
    }
  }
  return initial;
}

function shouldRenderField(field: Field, form: any) {
  if (field.name === 'valorTotal' || field.hidden) return false;
  if (field.showWhen?.hasValue) return Boolean(form[field.showWhen.field]);
  return true;
}

function isRequiredForMode(field: Field, mode: Mode, readonly: boolean) {
  if (readonly) return false;
  if (mode === 'edit' && field.name === 'senha') return false;
  return Boolean(field.required);
}

function sanitize(form: any, fields: Field[], mode: Mode) {
  const payload: any = {};
  for (const field of fields) {
    if (field.hidden && field.name !== 'id') continue;
    if (field.name === 'valorTotal') continue;
    if (mode === 'edit' && field.name === 'senha' && !form[field.name]) continue;
    if (form[field.name] === undefined) continue;
    if (form[field.name] === '') {
      payload[field.name] = field.required ? form[field.name] : null;
      continue;
    }
    payload[field.name] = ['number', 'money'].includes(field.type || '') && form[field.name] !== null ? Number(form[field.name]) : form[field.name];
  }
  return payload;
}



