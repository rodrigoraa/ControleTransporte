import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTimeline, FragmentRows } from './CrudPage';

const evento = {
  id: 'alteracao-1',
  createdAt: '2026-10-11T12:00:00Z',
  acao: 'ALTERACAO_COMPOSICAO',
  observacoes: 'Alteração de carretas/dolly vinculados ao cavalo mecânico',
};
const motoristasHistoricos = [{ id: 'motorista-1', nome: 'João' }, { id: 'motorista-2', nome: 'Maria' }];

describe('ações dos lançamentos financeiros', () => {
  it.each([
    { cenario: 'manual', row: { id: 'manual-1', importacao: null }, canWrite: true, mutavel: true },
    { cenario: 'importado', row: { id: 'imported-1', importacao: { id: 'import-1' } }, canWrite: true, mutavel: false },
    { cenario: 'despesa automática', row: { id: 'commission-1', faturamentoOrigemId: 'billing-1' }, canWrite: true, mutavel: false },
    { cenario: 'cadastro protegido', row: { id: 'protected-1', protegido: true }, canWrite: true, mutavel: false },
    { cenario: 'usuário sem escrita', row: { id: 'manual-1' }, canWrite: false, mutavel: false },
  ])('mantém consulta e respeita as ações de $cenario', ({ row, canWrite, mutavel }) => {
    const noop = () => undefined;
    const html = renderToStaticMarkup(createElement('table', null, createElement('tbody', null, createElement(FragmentRows, {
      group: { key: 'financeiro', title: 'Faturamentos', rows: [row] }, grouped: false, tableFields: [],
      resource: { path: 'faturamento', title: 'Faturamentos', endpoint: '/lancamentos-financeiros', fields: [] },
      canWrite, onConsumo: noop, onHistorico: noop, onView: noop, onEdit: noop, onDelete: noop,
    }))));

    expect(html).toContain('title="Visualizar"');
    expect(html.includes('title="Editar"')).toBe(mutavel);
    expect(html.includes('title="Excluir"')).toBe(mutavel);
    if ('importacao' in row && row.importacao) expect(html).toContain('>Importado</span>');
    if ('faturamentoOrigemId' in row) expect(html).toContain('>Automática</span>');
  });
});

describe('histórico da composição na tela do cavalo', () => {
  it('preserva a descrição da composição sem inventar uma remoção de motorista', () => {
    const events = buildTimeline({
      motoristasHistoricos,
      alteracoes: [{ ...evento, dadosAntes: { motoristaId: 'motorista-1' }, dadosDepois: { cavalo: { motoristaId: 'motorista-1' }, conjunto: { id: 'conjunto-novo' } } }],
    }, true);
    expect(events[0].description).toBe(evento.observacoes);
  });

  it('identifica uma troca real de motorista nos snapshots aninhados da composição', () => {
    const events = buildTimeline({
      motoristasHistoricos,
      alteracoes: [{ ...evento, dadosAntes: { motoristaId: 'motorista-1' }, dadosDepois: { cavalo: { motoristaId: 'motorista-2' } } }],
    }, true);
    expect(events[0].description).toBe('Motorista alterado de João para Maria.');
  });

  it('continua reconhecendo a remoção de motorista em alterações cadastrais simples', () => {
    const events = buildTimeline({
      motoristasHistoricos,
      alteracoes: [{ ...evento, acao: 'ATUALIZACAO', dadosAntes: { motoristaId: 'motorista-1' }, dadosDepois: { motoristaId: null } }],
    }, true);
    expect(events[0].description).toBe('Motorista alterado de João para Sem motorista.');
  });

  it('mantém a descrição do desengate quando a transferência libera a composição anterior', () => {
    const observacoes = 'Transferência de implementos; cavalo sem composição ativa';
    const events = buildTimeline({
      motoristasHistoricos,
      alteracoes: [{ ...evento, acao: 'DESENGATE_IMPLEMENTO', observacoes, dadosAntes: { cavaloMecanico: { motoristaId: 'motorista-1' } }, dadosDepois: { conjunto: null, motivoSemComposicao: 'Nenhum implemento restante' } }],
    }, true);
    expect(events[0].description).toBe(observacoes);
  });
});
