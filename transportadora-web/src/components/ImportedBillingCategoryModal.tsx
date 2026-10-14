import { X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { api } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { date, money } from '../utils/formatters';
import { SearchableSelect } from './SearchableSelect';

export type BillingCategory = { id: string; nome: string; ativo: boolean; tipoLancamento: string | null };
type ImportedBilling = { id: string; data: string; placa: string; valorTotal: string | number; categoriaId: string | null; categoriaFinanceira?: { nome: string } | null };

export function importedBillingCategoryOptions(categories: BillingCategory[]) {
  return categories.filter((category) => category.ativo && (category.tipoLancamento === null || category.tipoLancamento === 'FATURAMENTO'))
    .map((category) => ({ value: category.id, label: category.nome }));
}

export function ImportedBillingCategoryModal({ item, onClose, onSaved }: { item: ImportedBilling; onClose: () => void; onSaved: () => void }) {
  const [categories, setCategories] = useState<BillingCategory[]>([]);
  const [categoryId, setCategoryId] = useState(item.categoriaId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEscapeToClose(onClose, !saving);
  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError('');
    async function load() {
      const found: BillingCategory[] = [];
      let page = 1;
      do {
        const { data } = await api.get('/categorias-financeiras', { params: { ativo: 'true', page, limit: 100 } });
        const rows: BillingCategory[] = Array.isArray(data.data) ? data.data : [];
        found.push(...rows);
        if (!rows.length || found.length >= Number(data.total || found.length)) break;
        page += 1;
      } while (true);
      if (mounted) {
        setCategories(found);
        const available = importedBillingCategoryOptions(found);
        setCategoryId((current) => current && current !== item.categoriaId && !available.some((option) => option.value === current) ? item.categoriaId || '' : current);
      }
    }
    load().catch(() => { if (mounted) setLoadError('Não foi possível carregar as categorias. Clique em Recarregar categorias.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [retry, item.categoriaId]);

  const options = importedBillingCategoryOptions(categories);
  if (item.categoriaId && !options.some((option) => option.value === item.categoriaId)) {
    options.push({ value: item.categoriaId, label: `${item.categoriaFinanceira?.nome || 'Categoria atual'} (classificação atual)` });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || loading || loadError) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/lancamentos-financeiros/${item.id}/categoria`, { categoriaId: categoryId || null });
    } catch (requestError) {
      const fallback = 'Não foi possível salvar a categoria. Confira a classificação na lista antes de tentar novamente.';
      const message = await apiErrorMessage(requestError, fallback);
      setError(message === 'Internal server error' ? fallback : message);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return <div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-label="Editar categoria do faturamento importado" onSubmit={(event) => void submit(event)}>
    <div className="modal-header"><h2 ref={headingRef} tabIndex={-1}>Editar categoria</h2><button type="button" className="icon-button" aria-label="Fechar edição de categoria" disabled={saving} onClick={onClose}><X size={18} /></button></div>
    <p>Faturamento importado · {item.placa} · {date(item.data)} · {money(item.valorTotal)}</p>
    <p>A categoria é uma classificação interna preenchida manualmente. Os dados da planilha, do frete e da comissão serão preservados.</p>
    {error && <div className="import-error-notice" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
    {loadError && <div className="form-warning" role="alert">{loadError}</div>}
    {loading && <p role="status">Carregando categorias...</p>}
    <label>Categoria<SearchableSelect value={categoryId} options={options} emptyLabel="Sem categoria" ariaLabel="Categoria do faturamento importado"
      disabled={loading || saving || Boolean(loadError)} onChange={(value) => { setCategoryId(value); setError(''); }} /></label>
    {!loading && !loadError && options.length === 0 && <p>Nenhuma categoria compatível disponível. Cadastre uma categoria de faturamento em Categorias financeiras e recarregue esta lista.</p>}
    <button type="button" className="button ghost" disabled={loading || saving} onClick={() => setRetry((value) => value + 1)}>Recarregar categorias</button>
    <div className="modal-actions"><button type="button" className="button ghost" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving || loading || Boolean(loadError)}>{saving ? 'Salvando...' : 'Salvar categoria'}</button></div>
  </form></div>;
}
