import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildTimeline, FragmentRows, RecordModal } from './CrudPage';
import { crudResources } from './resources';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin', perfil: 'ADMIN' }, logout: vi.fn() }) }));

const evento = {
  id: 'alteracao-1',
  createdAt: '2026-10-11T12:00:00Z',
  acao: 'ALTERACAO_COMPOSICAO',
  observacoes: 'Alteração de carretas/dolly vinculados ao cavalo mecânico',
};
const motoristasHistoricos = [{ id: 'motorista-1', nome: 'João' }, { id: 'motorista-2', nome: 'Maria' }];

describe('ações dos lançamentos financeiros', () => {
  it('abre a edição completa do importado com controle somente para leitura', () => {
    const noop = () => undefined;
    const resource = crudResources.find((entry) => entry.path === 'faturamento')!;
    const html = renderToStaticMarkup(createElement(RecordModal, {
      resource, mode: 'edit', item: {
        id: 'bill', importacao: { id: 'source' }, numeroControle: 1, data: '2026-10-11',
        cavaloMecanicoId: 'horse', motoristaId: 'driver', clienteId: 'client', valorUnitario: 4850,
        quantidade: 32500, unidadeQuantidade: 'KG', multiplicarQuantidade: false, quantidadeEixosComissao: 7,
        tipoComissao: 'PERCENTUAL', percentualComissao: 12, valorComissaoPorViagem: 240,
      }, onClose: noop, onSaved: noop,
    }));
    expect(html).toContain('value="F01"');
    expect(html).toMatch(/<input[^>]*readonly=""[^>]*aria-label="Controle do faturamento"/);
    expect(html).toMatch(/<input type="date"/);
    for (const label of ['Cavalo mecânico', 'Motorista', 'Cliente', 'Categoria', 'Descrição', 'Quantidade', 'Valor unitário', 'Observações', 'Salvar']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('type="number"');
    expect(resource.fields.find((field) => field.name === 'numeroControle')).toMatchObject({ hidden: true, table: true, filterKey: 'numeroControle' });
    expect(crudResources.find((entry) => entry.path === 'despesas')!.fields.some((field) => field.name === 'numeroControle')).toBe(false);
  });
  it.each([
    { tipoLancamento: 'FATURAMENTO', importacao: { id: 'import' }, canWrite: true },
    { tipoLancamento: 'FATURAMENTO', importacao: { id: 'import' }, canWrite: false },
    { tipoLancamento: 'FATURAMENTO', importacao: null, canWrite: true },
    { tipoLancamento: 'DESPESA', importacao: { id: 'import' }, canWrite: true },
    { tipoLancamento: 'FATURAMENTO', importacao: { id: 'import' }, faturamentoOrigemId: 'bill', canWrite: true },
    { tipoLancamento: 'FATURAMENTO', importacao: { id: 'import' }, protegido: true, canWrite: true },
  ])('mantém a categoria na coluna e a edição no lápis: %j', ({ canWrite, ...fields }) => {
    const noop = () => undefined;
    const html = renderToStaticMarkup(createElement('table', null, createElement('tbody', null, createElement(FragmentRows, {
      group: { key: 'billing', title: 'Faturamento', rows: [{ id: 'bill', categoriaId: null, ...fields }] }, grouped: false,
      tableFields: [{ name: 'categoriaId', label: 'Categoria' }],
      resource: { path: 'faturamento', endpoint: '/lancamentos-financeiros', title: 'Faturamentos', fields: [] },
      canWrite, onConsumo: noop, onHistorico: noop, onView: noop, onEdit: noop, onDelete: noop,
    }))));
    expect(html).not.toContain('title="Editar categoria"');
    expect(html).toContain('Sem categoria');
    if (fields.importacao) {
      expect(html.includes('title="Editar"')).toBe(canWrite && !fields.faturamentoOrigemId && !fields.protegido);
      expect(html).not.toContain('title="Excluir"');
    }
  });
  it.each([
    { cenario: 'manual', row: { id: 'manual-1', importacao: null }, canWrite: true, mutavel: true },
    { cenario: 'importado', row: { id: 'imported-1', importacao: { id: 'import-1' } }, canWrite: true, mutavel: false },
    { cenario: 'despesa automática', row: { id: 'commission-1', faturamentoOrigemId: 'billing-1' }, canWrite: true, mutavel: false },
    { cenario: 'cadastro protegido', row: { id: 'protected-1', protegido: true }, canWrite: true, mutavel: false },
    { cenario: 'usuário sem escrita', row: { id: 'manual-1' }, canWrite: false, mutavel: false },
  ])('mantém consulta e respeita as ações de $cenario', ({ row, canWrite, mutavel }) => {
    const noop = () => undefined;
    const html = renderToStaticMarkup(createElement('table', null, createElement('tbody', null, createElement(FragmentRows, {
      group: { key: 'financeiro', title: 'Faturamentos', rows: [row] }, grouped: false, tableFields: [{ name: 'numeroControle', label: 'Controle' }],
      resource: { path: 'faturamento', title: 'Faturamentos', endpoint: '/lancamentos-financeiros', fields: [] },
      canWrite, onConsumo: noop, onHistorico: noop, onView: noop, onEdit: noop, onDelete: noop,
    }))));

    expect(html).toContain('title="Visualizar"');
    const actions = html.slice(html.indexOf('<td class="actions crud-row-actions">'));
    expect(actions).toContain('class="row-actions"');
    expect(actions).not.toContain('>Importado</span>');
    expect(actions).not.toContain('Categoria');
    expect(html.includes('title="Editar"')).toBe(mutavel || ('importacao' in row && Boolean(row.importacao) && canWrite));
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
