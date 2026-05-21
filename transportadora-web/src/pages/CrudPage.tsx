import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Toast } from '../components/Toast';
import { api } from '../services/api';
import { date, money } from '../utils/formatters';
import { Field, Resource } from './resources';

type Mode = 'create' | 'edit' | 'view';

export function CrudPage({ resource }: { resource: Resource }) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: Mode; item: any } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const limit = 10;

  const tableFields = useMemo(() => resource.fields.filter((field) => field.table), [resource]);

  async function load() {
    try {
      const { data } = await api.get(resource.endpoint, { params: { page, limit, search, ...resource.fixedParams } });
      setRows(data.data);
      setTotal(data.total);
    } catch {
      setToast({ type: 'error', message: 'Nao foi possivel carregar os registros.' });
    }
  }

  useEffect(() => {
    load();
  }, [resource.endpoint, page]);

  async function remove(item: any) {
    if (!confirm('Confirma a exclusao deste registro?')) return;
    try {
      await api.delete(`${resource.endpoint}/${item.id}`);
      setToast({ type: 'success', message: 'Registro excluido com sucesso.' });
      load();
    } catch {
      setToast({ type: 'error', message: 'Nao foi possivel excluir o registro.' });
    }
  }

  return (
    <section className="page">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header">
        <div>
          <h1>{resource.title}</h1>
          <p>Cadastro, edicao, detalhes e exclusao.</p>
        </div>
        <button className="button primary" onClick={() => setModal({ mode: 'create', item: {} })}>
          <Plus size={18} /> Novo
        </button>
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
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {tableFields.map((field) => <td key={field.name}>{renderRowValue(row, field)}</td>)}
                  <td className="actions">
                    <button className="icon-button" title="Visualizar" onClick={() => setModal({ mode: 'view', item: row })}><Eye size={17} /></button>
                    <button className="icon-button" title="Editar" onClick={() => setModal({ mode: 'edit', item: row })}><Pencil size={17} /></button>
                    <button className="icon-button danger" title="Excluir" onClick={() => remove(row)}><Trash2 size={17} /></button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={tableFields.length + 1}>Nenhum registro encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>{total} registros</span>
          <button className="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <strong>{page}</strong>
          <button className="button" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>Proxima</button>
        </div>
      </div>
      {modal && (
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
      )}
    </section>
  );
}

function RecordModal({ resource, mode, item, onClose, onSaved }: { resource: Resource; mode: Mode; item: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>(() => ({ ...prepareInitial(item, resource.fields), ...resource.fixedValues }));
  const [relationOptions, setRelationOptions] = useState<Record<string, { label: string; value: string }[]>>({});
  const [error, setError] = useState('');
  const readonly = mode === 'view';

  useEffect(() => {
    const fields = resource.fields.filter((field) => field.relation);
    if (!fields.length) return;

    Promise.all(
      fields.map(async (field) => {
        const { data } = await api.get(field.relation!.endpoint, { params: { page: 1, limit: 100, ...field.relation!.params } });
        const options = data.data.map((row: any) => ({
          value: row[field.relation?.valueKey || 'id'],
          label: relationLabel(row, field),
        }));
        return [field.name, options] as const;
      }),
    )
      .then((entries) => setRelationOptions(Object.fromEntries(entries)))
      .catch(() => setError('Nao foi possivel carregar as opcoes de relacionamento.'));
  }, [resource.fields]);

  function update(field: Field, value: string | boolean) {
    const next = typeof value === 'string' && field.mask ? field.mask(value) : value;
    setForm((current: any) => ({ ...current, [field.name]: next }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...sanitize(form, resource.fields, mode), ...resource.fixedValues };
    try {
      if (mode === 'create') await api.post(resource.endpoint, payload);
      if (mode === 'edit') await api.patch(`${resource.endpoint}/${item.id}`, payload);
      onSaved();
    } catch (requestError: any) {
      const response = requestError.response?.data;
      const message = Array.isArray(response?.message) ? response.message.join(' ') : response?.message;
      setError(message || 'Verifique os campos e tente novamente.');
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
          {resource.fields.filter((field) => field.name !== 'valorTotal' && !field.hidden).map((field) => (
            <label key={field.name} className={field.type === 'textarea' ? 'wide' : ''}>
              {field.label}
              {field.type === 'select' ? (
                <select disabled={readonly} value={form[field.name] || ''} onChange={(e) => update(field, e.target.value)}>
                  <option value="">Selecione</option>
                  {(field.relation ? relationOptions[field.name] : field.options)?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea disabled={readonly} value={form[field.name] || ''} onChange={(e) => update(field, e.target.value)} />
              ) : field.type === 'checkbox' ? (
                <input disabled={readonly} type="checkbox" checked={Boolean(form[field.name])} onChange={(e) => update(field, e.target.checked)} />
              ) : (
                <input disabled={readonly} type={field.type === 'money' ? 'number' : field.type || 'text'} step={field.type === 'money' ? '0.01' : undefined} value={form[field.name] || ''} required={field.required && !readonly} onChange={(e) => update(field, e.target.value)} />
              )}
            </label>
          ))}
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button ghost" onClick={onClose}>Cancelar</button>
          {!readonly && <button className="button primary">Salvar</button>}
        </div>
      </form>
    </div>
  );
}

function renderValue(value: any, field: Field) {
  if (field.relation?.objectKey && value === undefined) return '-';
  if (field.type === 'money') return money(value);
  if (field.type === 'date') return date(value);
  if (field.type === 'checkbox') return value ? 'Sim' : 'Nao';
  return value || '-';
}

function renderRowValue(row: any, field: Field) {
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

function prepareInitial(item: any, fields: Field[]) {
  const initial = { ...item };
  for (const field of fields) {
    if (field.type === 'date' && initial[field.name]) initial[field.name] = String(initial[field.name]).slice(0, 10);
    if (field.type === 'checkbox' && field.required && initial[field.name] === undefined) initial[field.name] = true;
  }
  return initial;
}

function sanitize(form: any, fields: Field[], mode: Mode) {
  const payload: any = {};
  for (const field of fields) {
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
