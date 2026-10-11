import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FinancialImportModal, ImportCompositionDetails, ImportRowEditor } from './FinancialImportModal';
import { api } from '../services/api';
import { ImportRow } from '../utils/financialImport';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const row: ImportRow = {
  linha: 2, chaveExterna: 'ctrc:12345', data: '2026-10-01', placa: 'ABC1D23', peso: '32500', valor: '4850',
  cavalo: { id: 'horse-1', placa: 'ABC1D23' }, conjunto: { id: 'historical-7', nome: 'Bitrem anterior à transferência' },
  motorista: { id: 'driver-1', nome: 'João' }, cliente: { id: 'client-1', nome: 'Cliente' },
  motoristaExterno: { codigo: '1', nome: 'João' }, clienteExterno: { codigo: '2', nome: 'Cliente' },
  sugestoesMotorista: [], sugestoesCliente: [], quantidadeEixos: 7, comissaoNecessaria: true,
  comissao: { tipoComissao: 'PERCENTUAL', percentualComissao: 12, valorComissaoPorViagem: 240, descontoImpostos: true },
  status: 'PRONTO', pendencias: [],
};

function renderEditor(importRow: ImportRow, cavaloMecanicoId?: string) {
  return renderToStaticMarkup(<ImportRowEditor row={importRow} selection={cavaloMecanicoId ? { linha: row.linha, cavaloMecanicoId } : undefined}
    catalog={{ cavalos: [], motoristas: [], clientes: [] }} disabled={false} onChange={() => undefined} onReset={() => undefined} />);
}

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

  it('mostra a composição, os eixos históricos e a data do faturamento na prévia', () => {
    const html = renderToStaticMarkup(<ImportCompositionDetails row={row} />);
    expect(html).toContain('Bitrem anterior à transferência');
    expect(html).toContain('7 eixos · ');
    expect(html).toContain('01/10/2026');
  });

  it('permite configurar comissão histórica sem oferecer alteração de conjunto ou eixos', () => {
    const html = renderEditor(row);
    expect(html).toContain('Bitrem anterior à transferência');
    expect(html).toContain('7 eixos · ');
    expect(html).toContain('01/10/2026');
    expect(html).toContain('aria-label="Comissão da linha 2"');
    expect(html).toContain('Comissão líquida');
    expect(html).not.toContain('aria-label="Composição');
    expect(html).not.toContain('name="conjuntoId"');
    expect(html).not.toContain('name="quantidadeEixos"');
  });

  it('explica histórico pendente e não apresenta ausência de histórico como faturamento sem comissão', () => {
    const html = renderEditor({ ...row, conjunto: null, quantidadeEixos: null, status: 'PENDENTE_COMPOSICAO', comissaoNecessaria: false });
    expect(html).toContain('Não foi possível determinar a composição em');
    expect(html).toContain('01/10/2026');
    expect(html).toContain('A importação desta linha permanece bloqueada.');
    expect(html).not.toContain('aria-label="Comissão da linha 2"');
    expect(html).not.toContain('este faturamento não gera comissão');
  });

  it('exige atualizar a composição histórica depois de selecionar outro cavalo', () => {
    const html = renderEditor(row, 'horse-2');
    expect(html).toContain('atualize a prévia para verificar a composição histórica');
    expect(html).not.toContain('aria-label="Comissão da linha 2"');
    expect(html).not.toContain('Bitrem anterior à transferência');
  });
});
