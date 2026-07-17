import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Toast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { date, maskPlate, money } from '../utils/formatters';
import { carrocerias, crudResources, Field, Resource, tiposImplemento } from './resources';

type Mode = 'create' | 'edit' | 'view';
const relationPageLimit = 100;

export function CrudPage({ resource }: { resource: Resource }) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: Mode; item: any } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
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
      load();
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
              load();
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
              load();
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

function FragmentRows({ group, grouped, tableFields, resource, canWrite, onView, onEdit, onDelete }: {
  group: { key: string; title: string; rows: any[] };
  grouped: boolean;
  tableFields: Field[];
  resource: Resource;
  canWrite: boolean;
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
            <button className="icon-button" title="Visualizar" onClick={() => onView(row)}><Eye size={17} /></button>
            {canWrite && !row.protegido && <button className="icon-button" title="Editar" onClick={() => onEdit(row)}><Pencil size={17} /></button>}
            {canWrite && !row.protegido && <button className="icon-button danger" title={resource.path === 'caminhoes' ? 'Excluir cavalo mecânico' : 'Excluir'} onClick={() => onDelete(row)}><Trash2 size={17} /></button>}
          </td>
        </tr>
      ))}
    </>
  );
}

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
        <select value={value || ''} required={field.required} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione</option>
          {(field.relation ? relationOptions[field.name] : field.options)?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
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

function ConfirmModal({ title, message, onCancel, onConfirm }: { title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
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
          <button type="button" className="button danger" onClick={onConfirm}>Excluir</button>
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
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const readonly = mode === 'view';

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
    setForm((current: any) => {
      const updated = { ...current, [field.name]: next };
      if (field.name === 'cavaloMecanicoId' && typeof next === 'string') {
        const cavalo = relationRows[field.name]?.find((row: any) => row.id === next);
        updated.motoristaId = cavalo?.motoristaId || '';
      }
      return updated;
    });
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
            const selectedCavalo = field.name === 'cavaloMecanicoId'
              ? relationRows[field.name]?.find((row) => row.id === form[field.name])
              : null;
            return (
              <label key={field.name} className={field.type === 'textarea' ? 'wide' : ''}>
                {field.label}
                {field.type === 'select' ? (
                  <>
                    <div className="relation-control">
                      <select disabled={readonly} value={form[field.name] || ''} required={isRequiredForMode(field, mode, readonly)} onChange={(e) => update(field, e.target.value)}>
                        <option value="">Selecione</option>
                        {(field.relation ? relationOptions[field.name] : field.options)?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      {!readonly && field.relation && quickCreateResource(field) && (
                        <button type="button" className="button" onClick={() => setQuickCreate({ field, resource: quickCreateResource(field)! })}>
                          <Plus size={16} /> Cadastrar
                        </button>
                      )}
                    </div>
                    {selectedCavalo && <SelectedCavaloComposition cavalo={selectedCavalo} />}
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
  if (carretas.length === 2 && !dollys.length) return 'Se houver segunda carreta, informe dolly.';
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



