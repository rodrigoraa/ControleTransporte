import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ImportedBillingCategoryModal, importedBillingCategoryOptions } from './ImportedBillingCategoryModal';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), patch: vi.fn() } }));

describe('categoria do faturamento importado', () => {
  it('oferece categorias ativas de faturamento e genéricas, excluindo despesas e inativas', () => {
    const categories = [
      { id: 'billing', nome: 'Frete', ativo: true, tipoLancamento: 'FATURAMENTO' },
      { id: 'generic', nome: 'Geral', ativo: true, tipoLancamento: null },
      { id: 'expense', nome: 'Comissão', ativo: true, tipoLancamento: 'DESPESA' },
      { id: 'inactive', nome: 'Antiga', ativo: false, tipoLancamento: 'FATURAMENTO' },
    ];
    expect(importedBillingCategoryOptions(categories)).toEqual([{ value: 'billing', label: 'Frete' }, { value: 'generic', label: 'Geral' }]);
  });

  it('identifica o frete e oferece somente a classificação sem salvar durante o carregamento', () => {
    const html = renderToStaticMarkup(<ImportedBillingCategoryModal item={{ id: 'bill-1', placa: 'NSC1I98', data: '2026-10-11', valorTotal: '4850', categoriaId: null }} onClose={() => undefined} onSaved={() => undefined} />);
    expect(html).toContain('Editar categoria');
    expect(html).toContain('NSC1I98');
    expect(html).toContain('Sem categoria');
    expect(html).toContain('Categoria do faturamento importado');
    expect(html).toContain('Os dados da planilha, do frete e da comissão serão preservados');
    expect(html).toContain('Salvar categoria');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('type="date"');
    expect(api.patch).not.toHaveBeenCalled();
  });
});
