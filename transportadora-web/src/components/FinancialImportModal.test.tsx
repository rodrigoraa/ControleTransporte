import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FinancialImportModal } from './FinancialImportModal';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

describe('modal de importação financeira', () => {
  it('inicia selecionando Excel, sem importar ou confirmar antes da prévia', () => {
    const html = renderToStaticMarkup(<FinancialImportModal onClose={() => undefined} onImported={() => undefined} />);
    expect(html).toContain('Importar planilha');
    expect(html).toContain('type="file"');
    expect(html).toContain('.xls,.xlsx');
    expect(html).toContain('Conferir planilha');
    expect(html).not.toContain('Confirmar importação');
    expect(html).not.toContain('Importação concluída');
    expect(api.post).not.toHaveBeenCalled();
  });
});
