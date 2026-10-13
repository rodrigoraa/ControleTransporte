import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FinancialImportModal, ImportBatchCommissionAction, ImportCompositionDetails, ImportRowEditor } from './FinancialImportModal';
import { api } from '../services/api';
import { batchImportCommissionAvailability, ImportRow, ImportSelection } from '../utils/financialImport';

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

function renderBatchAction(rows: ImportRow[], selected: number[], selections: Record<number, ImportSelection> = {}, disabled = false) {
  return renderToStaticMarkup(<ImportBatchCommissionAction availability={batchImportCommissionAvailability(rows, selected, selections)} disabled={disabled} onApply={() => undefined} />);
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

  it('desabilita comissão em lote e explica o histórico pendente das linhas selecionadas', () => {
    const pending = { ...row, status: 'PENDENTE_COMPOSICAO', conjunto: null, quantidadeEixos: null };
    const html = renderBatchAction([pending], [2]);
    expect(html).toContain('disabled=""');
    expect(html).toContain('Comissão aplicável a 0 de 1 linha(s)');
    expect(html).toContain('carretas e os eixos conferidos na data do frete');
    expect(html).toContain('Escolher comissão não resolve essa pendência');
    expect(html).not.toContain('Se alterou um cavalo');
  });

  it('habilita aplicação parcial e informa a contagem quando existe linha elegível', () => {
    const pending = { ...row, linha: 3, status: 'PENDENTE_COMPOSICAO', conjunto: null, quantidadeEixos: null };
    const html = renderBatchAction([{ ...row, status: 'PENDENTE_COMISSAO' }, pending], [2, 3]);
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('Comissão aplicável a 1 de 2 linha(s)');
    expect(html).toContain('1 linha(s) precisam ter as carretas e os eixos conferidos');
  });

  it('desabilita aplicação em cavalo alterado e pede revalidar a composição na prévia', () => {
    const html = renderBatchAction([row], [2], { 2: { linha: 2, cavaloMecanicoId: 'horse-2' } });
    expect(html).toContain('disabled=""');
    expect(html).toContain('Atualizar prévia para conferir as carretas');
  });

  it('orienta seleção vazia e mantém indisponível durante uma requisição', () => {
    const empty = renderBatchAction([row], []);
    expect(empty).toContain('disabled=""');
    expect(empty).toContain('Selecione linhas para aplicar comissão');
    expect(renderBatchAction([row], [2], {}, true)).toContain('disabled=""');
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
    expect(html).toContain('Não foi possível confirmar quais carretas estavam com o cavalo');
    expect(html).toContain('01/10/2026');
    expect(html).toContain('A importação desta linha permanece bloqueada.');
    expect(html).not.toContain('aria-label="Comissão da linha 2"');
    expect(html).not.toContain('este faturamento não gera comissão');
  });

  it('exige atualizar a composição histórica depois de selecionar outro cavalo', () => {
    const html = renderEditor(row, 'horse-2');
    expect(html).toContain('Você alterou o cavalo');
    expect(html).toContain('Atualizar prévia para conferir as carretas');
    expect(html).not.toContain('aria-label="Comissão da linha 2"');
    expect(html).not.toContain('Bitrem anterior à transferência');
  });
});
