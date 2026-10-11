import { describe, expect, it } from 'vitest';
import { buildTimeline } from './CrudPage';

const evento = {
  id: 'alteracao-1',
  createdAt: '2026-10-11T12:00:00Z',
  acao: 'ALTERACAO_COMPOSICAO',
  observacoes: 'Alteração de carretas/dolly vinculados ao cavalo mecânico',
};
const motoristasHistoricos = [{ id: 'motorista-1', nome: 'João' }, { id: 'motorista-2', nome: 'Maria' }];

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
