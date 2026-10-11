import { Prisma, StatusGeral, TipoConjuntoOperacional } from '@prisma/client';
import { ComposicaoHistorica, composicaoHistoricaSelect, resolverComposicaoHistorica } from './composicao-historica';

const dia = (value: string) => new Date(value.includes('T') ? value : value + 'T00:00:00Z');
function composicao(id = 'antigo', inicio = '2026-10-01', fim: string | null = '2026-10-08', extra: Partial<ComposicaoHistorica> = {}): ComposicaoHistorica {
  return {
    id, nome: 'Composição ' + id, cavaloMecanicoId: 'cavalo-a', tipo: TipoConjuntoOperacional.BITREM,
    quantidadeTotalEixos: 7, status: fim ? StatusGeral.INATIVO : StatusGeral.ATIVO,
    createdAt: dia('2026-10-11'), justificativaSemImplemento: null,
    implementos: ['imp-1', 'imp-2'].map((implementoId, index) => ({
      implementoId, ordem: index + 1, dataInicio: dia(inicio), dataFim: fim ? dia(fim) : null,
    })),
    historicos: [], ...extra,
  };
}
function snapshot(value: unknown): Prisma.JsonValue { return JSON.parse(JSON.stringify(value)); }
function evento(acao: string, data: string, antes: unknown = null, depois: unknown = null) {
  return { acao, createdAt: dia(data), dadosAntes: snapshot(antes), dadosDepois: snapshot(depois) };
}
const resolver = (conjuntos: ComposicaoHistorica[], data = '2026-10-04', cavalo = 'cavalo-a') => resolverComposicaoHistorica(conjuntos, data, cavalo);

describe('resolução da composição histórica da frota', () => {
  it('escolhe composição encerrada 7 eixos para faturamento anterior à transferência, sem usar a atual', () => {
    const antiga = composicao();
    const atual = composicao('atual', '2026-10-08', null, { quantidadeTotalEixos: 6 });
    expect(resolver([antiga, atual])).toMatchObject({ status: 'RESOLVIDA', conjuntoId: antiga.id, quantidadeTotalEixos: 7 });
    expect(resolver([antiga, atual], '2026-10-10')).toMatchObject({ status: 'RESOLVIDA', conjuntoId: atual.id, quantidadeTotalEixos: 6 });
  });

  it('usa [início,fim) e permite troca exata à meia-noite sem dupla vigência', () => {
    const antiga = composicao();
    const nova = composicao('nova', '2026-10-08', null);
    expect(resolver([antiga, nova], '2026-10-07').conjuntoId).toBe('antigo');
    expect(resolver([antiga, nova], '2026-10-08').conjuntoId).toBe('nova');
    expect(resolver([antiga], '2026-10-08').status).toBe('SEM_HISTORICO');
  });

  it('não escolhe arbitrariamente quando duas composições cobrem partes do mesmo dia', () => {
    const antiga = composicao('antiga', '2026-10-01', '2026-10-08T12:00:00Z');
    const nova = composicao('nova', '2026-10-08T12:00:00Z', null);
    expect(resolver([antiga, nova], '2026-10-08')).toMatchObject({ status: 'AMBIGUA', conjuntoId: null, candidatos: ['antiga', 'nova'] });
  });

  it.each([
    ['2026-10-04T12:00:00Z', null],
    ['2026-10-01', '2026-10-04T12:00:00Z'],
  ])('exige cobertura do dia inteiro mesmo quando só existe um candidato', (inicio, fim) => {
    expect(resolver([composicao('parcial', inicio!, fim)], '2026-10-04').status).toBe('AMBIGUA');
  });

  it('marca sobreposição e períodos de vínculos diferentes como ambíguos', () => {
    expect(resolver([composicao(), composicao('outro')]).status).toBe('AMBIGUA');
    const misturada = composicao();
    misturada.implementos[1].dataInicio = dia('2026-10-02');
    expect(resolver([misturada]).status).toBe('AMBIGUA');
    misturada.implementos[1].dataInicio = dia('2026-10-01');
    misturada.implementos[1].dataFim = dia('2026-10-07');
    expect(resolver([misturada]).status).toBe('AMBIGUA');
  });

  it('não recua a composição atual a uma data anterior ao primeiro vínculo conhecido', () => {
    const atual = composicao('atual', '2026-10-08', null);
    expect(resolver([atual], '2026-10-01')).toMatchObject({ status: 'SEM_HISTORICO', conjuntoId: null, quantidadeTotalEixos: null });
  });

  it('considera INATIVO historicamente vigente e ignora createdAt posterior às datas operacionais', () => {
    const antiga = composicao();
    antiga.historicos = [
      evento('CRIACAO_COMPOSICAO', '2026-10-01', null, { id: antiga.id, status: 'ATIVO' }),
      evento('ENCERRAMENTO_COMPOSICAO', '2026-10-08'),
    ];
    expect(resolver([antiga]).status).toBe('RESOLVIDA');
  });

  it('mantém eixos preservados no conjunto, sem recalcular dados atuais de implementos/cavalo', () => {
    const antiga = composicao();
    expect(resolver([antiga]).quantidadeTotalEixos).toBe(7);
    expect(composicaoHistoricaSelect.implementos.select).toEqual({ implementoId: true, ordem: true, dataInicio: true, dataFim: true });
  });

  it.each([
    { quantidadeTotalEixos: 9 },
    { cavaloMecanicoId: 'cavalo-b' },
    { tipo: 'SIMPLES' },
    { implementos: [{ implementoId: 'outro', ordem: 1 }] },
  ])('recusa mudança estrutural legada no mesmo conjunto: %s', (mudanca) => {
    const antiga = composicao();
    antiga.historicos = [evento('ATUALIZACAO_COMPOSICAO', '2026-10-06', { ...snapshot(antiga) as object, ...mudanca }, antiga)];
    expect(resolver([antiga]).status).toBe('AMBIGUA');
  });

  it('também identifica cavalo anterior em snapshot de conjunto legado movido no mesmo ID', () => {
    const movida = composicao('movida', '2026-10-01', null, { cavaloMecanicoId: 'cavalo-b' });
    movida.historicos = [evento('ATUALIZACAO_COMPOSICAO', '2026-10-08',
      { ...snapshot(movida) as object, cavaloMecanicoId: 'cavalo-a' }, movida)];
    expect(resolver([movida], '2026-10-04', 'cavalo-a').status).toBe('AMBIGUA');
    expect(resolver([movida], '2026-10-10', 'cavalo-b').status).toBe('AMBIGUA');
  });

  it('ignora snapshot de outro ID ao criar uma nova versão e mudanças descritivas', () => {
    const nova = composicao('nova', '2026-10-08', null);
    nova.historicos = [
      evento('ATUALIZACAO_COMPOSICAO', '2026-10-08', composicao(), nova),
      evento('ATUALIZACAO', '2026-10-10', { ...snapshot(nova) as object, nome: 'Nome anterior', observacoes: 'Antes' }, nova),
    ];
    expect(resolver([nova], '2026-10-09')).toMatchObject({ status: 'RESOLVIDA', conjuntoId: nova.id });
  });

  it('não usa vínculo aberto em conjunto inativo nem reativação legada sem novos períodos', () => {
    const inativa = composicao('inativa', '2026-10-01', null, { status: StatusGeral.INATIVO });
    expect(resolver([inativa]).status).toBe('AMBIGUA');
    const reativada = composicao('reativada', '2026-10-01', null);
    reativada.historicos = [evento('ATUALIZACAO_COMPOSICAO', '2026-10-08',
      { ...snapshot(reativada) as object, status: 'INATIVO' }, reativada)];
    expect(resolver([reativada]).status).toBe('AMBIGUA');
  });

  it('recusa encerramento histórico contraditório e criação posterior ao início dos vínculos', () => {
    const encerrada = composicao('encerrada', '2026-10-01', null);
    encerrada.historicos = [evento('ENCERRAMENTO_COMPOSICAO', '2026-10-08')];
    expect(resolver([encerrada], '2026-10-09').status).toBe('AMBIGUA');
    const criacao = composicao();
    criacao.historicos = [evento('CRIACAO_COMPOSICAO', '2026-10-05', null, { id: criacao.id, status: 'ATIVO' })];
    expect(resolver([criacao]).status).toBe('AMBIGUA');
  });

  it('ignora vínculos de duração zero de uma composição criada inativa', () => {
    const nuncaAtiva = composicao('inativa', '2026-10-04', '2026-10-04');
    expect(resolver([nuncaAtiva]).status).toBe('SEM_HISTORICO');
    expect(resolver([nuncaAtiva, composicao()]).status).toBe('RESOLVIDA');
  });

  it('não ignora vínculo zero quando snapshot denuncia composição ativa anterior substituída no mesmo ID', () => {
    const perdida = composicao('perdida', '2026-10-08', '2026-10-08');
    const anterior = composicao('perdida', '2026-10-01', null);
    anterior.implementos[0].implementoId = 'anterior';
    perdida.historicos = [evento('ATUALIZACAO_COMPOSICAO', '2026-10-08', anterior, perdida)];
    expect(resolver([perdida, composicao('outra')]).status).toBe('AMBIGUA');
  });

  it('resolve conjunto vazio justificado apenas com eventos de criação/encerramento', () => {
    const vazia = composicao('vazia', '2026-10-01', '2026-10-08', {
      implementos: [], quantidadeTotalEixos: 0, justificativaSemImplemento: 'Deslocamento sem implementos',
    });
    vazia.historicos = [
      evento('CRIACAO_COMPOSICAO', '2026-10-01', null, { id: vazia.id, status: 'ATIVO' }),
      evento('ENCERRAMENTO_COMPOSICAO', '2026-10-08'),
    ];
    expect(resolver([vazia])).toMatchObject({ status: 'RESOLVIDA', quantidadeTotalEixos: 0 });
    expect(resolver([vazia], '2026-10-08').status).toBe('SEM_HISTORICO');
  });

  it('não usa createdAt como única prova para conjunto sem vínculos', () => {
    const vazia = composicao('sem-prova', '2026-10-01', null, { implementos: [], createdAt: dia('2026-01-01') });
    expect(resolver([vazia]).status).toBe('AMBIGUA');
    vazia.historicos = [evento('CRIACAO_COMPOSICAO', '2026-10-01', null, { id: vazia.id, status: 'INATIVO' })];
    expect(resolver([vazia, composicao()]).status).toBe('AMBIGUA');
    vazia.status = StatusGeral.INATIVO;
    expect(resolver([vazia, composicao()]).status).toBe('RESOLVIDA');
  });

  it('recusa zero eixos com implementos e conjunto vazio sem justificativa', () => {
    expect(resolver([composicao('zero', '2026-10-01', null, { quantidadeTotalEixos: 0 })]).status).toBe('AMBIGUA');
    const vazia = composicao('vazia', '2026-10-01', null, { implementos: [], quantidadeTotalEixos: 0 });
    vazia.historicos = [evento('CRIACAO_COMPOSICAO', '2026-10-01', null, { id: vazia.id, status: 'ATIVO' })];
    expect(resolver([vazia]).status).toBe('AMBIGUA');
  });

  it('valida data calendário, aceita Date UTC e não modifica estruturas recebidas', () => {
    const antiga = composicao();
    const before = JSON.stringify(antiga);
    expect(resolverComposicaoHistorica([antiga], dia('2026-10-04'), 'cavalo-a').status).toBe('RESOLVIDA');
    for (const data of ['2026-02-30', 'inválida', '2026-10-04T00:00:00Z']) {
      expect(resolver([antiga], data).status).toBe('SEM_HISTORICO');
    }
    expect(JSON.stringify(antiga)).toBe(before);
    expect(resolver([antiga], '2026-10-04', 'outro-cavalo').status).toBe('SEM_HISTORICO');
  });
});
