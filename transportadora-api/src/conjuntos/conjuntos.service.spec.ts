import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, StatusGeral, TipoCavaloMecanico, TipoImplemento } from '@prisma/client';
import { ComposicoesCavaloService } from '../caminhoes/composicoes-cavalo.service';
import { ConjuntosService } from './conjuntos.service';

function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value) as T;
  if (Prisma.Decimal.isDecimal(value)) return new Prisma.Decimal(value as any) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T;
  return value;
}

function fixture() {
  const state: any = {
    cavalos: ['a', 'b'].map((id) => ({ id, placa: id.toUpperCase() + 'BC1D23', marca: 'Volvo', tipoCavalo: TipoCavaloMecanico.TRUCADO_6X2 })),
    implementos: ['imp-1', 'imp-2', 'imp-3'].map((id) => ({
      id, placa: id.toUpperCase(), tipo: TipoImplemento.CARRETA, quantidadeEixos: 2, capacidadeCarga: new Prisma.Decimal(30),
    })),
    conjuntos: [],
    financeiros: [],
    historicoConjuntoOperacional: [],
    historicoCavaloMecanico: [],
    historicoImplemento: [],
  };
  const hydrate = (conjunto: any) => conjunto ? clone({
    ...conjunto,
    cavaloMecanico: state.cavalos.find((item: any) => item.id === conjunto.cavaloMecanicoId),
    implementos: conjunto.implementos.map((link: any) => ({
      ...link, implemento: state.implementos.find((item: any) => item.id === link.implementoId),
    })).sort((a: any, b: any) => a.ordem - b.ordem),
  }) : null;
  const matches = (conjunto: any, where: any): boolean => {
    if (where.id && where.id !== conjunto.id) return false;
    if (where.status && where.status !== conjunto.status) return false;
    if (typeof where.cavaloMecanicoId === 'string' && where.cavaloMecanicoId !== conjunto.cavaloMecanicoId) return false;
    if (where.cavaloMecanicoId?.not === conjunto.cavaloMecanicoId) return false;
    if (where.OR && !where.OR.some((clause: any) => matches(conjunto, clause))) return false;
    const some = where.implementos?.some;
    if (some && !conjunto.implementos.some((link: any) =>
      some.implementoId.in.includes(link.implementoId) && (some.dataFim !== null || link.dataFim === null),
    )) return false;
    return true;
  };
  const tx: any = {
    cavaloMecanico: { findUnique: jest.fn(async ({ where }: any) => clone(state.cavalos.find((item: any) => item.id === where.id) || null)) },
    implemento: { findMany: jest.fn(async ({ where }: any) => clone(state.implementos.filter((item: any) => where.id.in.includes(item.id)))) },
    conjunto: {
      findUnique: jest.fn(async ({ where }: any) => hydrate(state.conjuntos.find((item: any) => item.id === where.id))),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => hydrate(state.conjuntos.find((item: any) => item.id === where.id))),
      findFirst: jest.fn(async ({ where }: any) => hydrate(state.conjuntos.find((item: any) => matches(item, where)))),
      findMany: jest.fn(async ({ where }: any) => state.conjuntos.filter((item: any) => matches(item, where)).map(hydrate)),
      create: jest.fn(async ({ data }: any) => {
        const conjunto = {
          id: 'novo-' + (state.conjuntos.length + 1), ...data,
          implementos: data.implementos.create.map((link: any) => ({ ...link })),
        };
        state.conjuntos.push(conjunto);
        return hydrate(conjunto);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const conjunto = state.conjuntos.find((item: any) => item.id === where.id);
        Object.assign(conjunto, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)));
        return hydrate(conjunto);
      }),
      delete: jest.fn(),
    },
    conjuntoImplemento: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const conjunto = state.conjuntos.find((item: any) => item.id === where.conjuntoId);
        const links = conjunto.implementos.filter((link: any) => link.dataFim === null);
        links.forEach((link: any) => Object.assign(link, data));
        return { count: links.length };
      }),
      count: jest.fn(async ({ where }: any) => state.conjuntos.find((item: any) => item.id === where.conjuntoId)?.implementos.length || 0),
      deleteMany: jest.fn(),
    },
    lancamentoFinanceiro: {
      count: jest.fn(async ({ where }: any) => state.financeiros.filter((item: any) => item.conjuntoId === where.conjuntoId).length),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    caminhao: { count: jest.fn(async () => 0) },
  };
  for (const model of ['historicoConjuntoOperacional', 'historicoCavaloMecanico', 'historicoImplemento']) {
    tx[model] = {
      create: jest.fn(async ({ data }: any) => { state[model].push(clone(data)); return clone(data); }),
      count: jest.fn(async ({ where }: any) => state[model].filter((item: any) => item.conjuntoId === where.conjuntoId).length),
    };
  }
  const prisma: any = {
    $transaction: jest.fn(async (callback: any) => {
      const before = clone(state);
      try { return await callback(tx); }
      catch (error) { Object.assign(state, before); throw error; }
    }),
    auditoria: { create: jest.fn() },
  };
  const seed = (cavaloMecanicoId: string, implementoIds: string[], status: StatusGeral = StatusGeral.ATIVO) => {
    const timestamp = new Date('2026-01-01T00:00:00Z');
    const conjunto = {
      id: 'antigo-' + (state.conjuntos.length + 1), nome: 'Composição histórica ' + cavaloMecanicoId,
      cavaloMecanicoId, status, tipo: implementoIds.length === 2 ? 'BITREM' : 'SIMPLES',
      quantidadeTotalEixos: 3 + implementoIds.length * 2, capacidadeTotal: new Prisma.Decimal(implementoIds.length * 30),
      justificativaSemImplemento: null, observacoes: 'Original',
      implementos: implementoIds.map((implementoId, index) => ({
        implementoId, ordem: index + 1, dataInicio: timestamp, dataFim: status === StatusGeral.ATIVO ? null : timestamp,
      })),
    };
    state.conjuntos.push(conjunto);
    return hydrate(conjunto);
  };
  const composicoes = new ComposicoesCavaloService();
  return { state, tx, prisma, seed, composicoes, service: new ConjuntosService(prisma, composicoes) };
}

describe('ConjuntosService: composição e histórico', () => {
  const timestamp = new Date('2026-10-11T12:00:00Z');
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(timestamp); });
  afterEach(() => jest.useRealTimers());

  it('transfere na criação, recalcula o restante e registra origem/destino na mesma transação', async () => {
    const { state, tx, prisma, seed, service } = fixture();
    const antigo = seed('a', ['imp-1', 'imp-2']);
    const novo = await service.create({ cavaloMecanicoId: 'b', implementoIds: ['imp-1'] });
    const encerrado = state.conjuntos.find((item: any) => item.id === antigo.id);
    const restante = state.conjuntos.find((item: any) => item.cavaloMecanicoId === 'a' && item.status === 'ATIVO');
    expect(encerrado).toMatchObject({
      nome: antigo.nome, status: 'INATIVO', cavaloMecanicoId: 'a', quantidadeTotalEixos: antigo.quantidadeTotalEixos,
      capacidadeTotal: antigo.capacidadeTotal,
    });
    expect(encerrado.implementos.every((link: any) => link.dataFim.getTime() === timestamp.getTime())).toBe(true);
    expect(restante).toMatchObject({ quantidadeTotalEixos: 5, tipo: 'SIMPLES' });
    expect(restante.implementos.map((item: any) => item.implementoId)).toEqual(['imp-2']);
    expect(novo.implementos[0]).toMatchObject({ implementoId: 'imp-1', dataInicio: timestamp, dataFim: null });
    expect(state.historicoImplemento).toEqual([expect.objectContaining({
      acao: 'TRANSFERENCIA_IMPLEMENTO', implementoId: 'imp-1',
      dadosAntes: expect.objectContaining({ cavaloMecanicoId: 'a', conjuntoId: antigo.id }),
      dadosDepois: expect.objectContaining({ cavaloMecanicoId: 'b', conjuntoId: novo.id }),
    })]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    expect(tx.conjuntoImplemento.deleteMany).not.toHaveBeenCalled();
  });

  it('versiona edição da composição e preserva o conjunto dos lançamentos antigos', async () => {
    const { state, tx, seed, service } = fixture();
    const antigo = seed('a', ['imp-1']);
    const financeiro = { id: 'fin-1', conjuntoId: antigo.id, cavaloMecanicoId: 'a', quantidadeTotalEixos: 5, valor: '100' };
    state.financeiros.push(clone(financeiro));
    const novo = await service.update(antigo.id, { implementoIds: ['imp-2'] });
    expect(novo.id).not.toBe(antigo.id);
    expect(state.conjuntos.find((item: any) => item.id === antigo.id)).toMatchObject({
      nome: antigo.nome, status: 'INATIVO', quantidadeTotalEixos: 5,
      implementos: [expect.objectContaining({ implementoId: 'imp-1', dataFim: timestamp })],
    });
    expect(state.financeiros).toEqual([financeiro]);
    expect(tx.lancamentoFinanceiro.update).not.toHaveBeenCalled();
    expect(tx.lancamentoFinanceiro.updateMany).not.toHaveBeenCalled();
    expect(state.historicoConjuntoOperacional).toEqual(expect.arrayContaining([
      expect.objectContaining({ conjuntoId: antigo.id, acao: 'ENCERRAMENTO_COMPOSICAO' }),
      expect.objectContaining({ conjuntoId: novo.id, acao: 'ATUALIZACAO_COMPOSICAO', dadosAntes: expect.objectContaining({ id: antigo.id }) }),
    ]));
  });

  it('registra transferência detalhada ao mover o próprio conjunto para outro cavalo', async () => {
    const { state, seed, service } = fixture();
    const antigo = seed('a', ['imp-1']);
    const novo = await service.update(antigo.id, { cavaloMecanicoId: 'b' });
    expect(novo.id).not.toBe(antigo.id);
    expect(state.historicoImplemento).toEqual([expect.objectContaining({
      implementoId: 'imp-1',
      dadosAntes: expect.objectContaining({ cavaloMecanicoId: 'a', conjuntoId: antigo.id }),
      dadosDepois: expect.objectContaining({ cavaloMecanicoId: 'b', conjuntoId: novo.id }),
    })]);
  });

  it('reativa com nova versão e resolve a posse atual dos implementos', async () => {
    const { state, seed, service } = fixture();
    const historico = seed('a', ['imp-1'], StatusGeral.INATIVO);
    const atual = seed('b', ['imp-1']);
    const snapshotHistorico = clone(state.conjuntos.find((item: any) => item.id === historico.id));
    const novo = await service.update(historico.id, { status: StatusGeral.ATIVO });
    expect(novo.id).not.toBe(historico.id);
    expect(state.conjuntos.find((item: any) => item.id === historico.id)).toEqual(snapshotHistorico);
    expect(state.conjuntos.find((item: any) => item.id === atual.id).status).toBe('INATIVO');
    const ativos = state.conjuntos.filter((item: any) => item.status === 'ATIVO' && item.implementos.some((link: any) => link.implementoId === 'imp-1' && link.dataFim === null));
    expect(ativos.map((item: any) => item.id)).toEqual([novo.id]);
  });

  it.each([StatusGeral.INATIVO, StatusGeral.MANUTENCAO])('fecha vínculos ao trocar status para %s sem recalcular o snapshot', async (status) => {
    const { state, seed, service } = fixture();
    const antigo = seed('a', ['imp-1']);
    const resultado = await service.update(antigo.id, { status });
    expect(resultado).toMatchObject({ id: antigo.id, nome: antigo.nome, status, quantidadeTotalEixos: antigo.quantidadeTotalEixos });
    expect(resultado.implementos[0].dataFim).toEqual(timestamp);
    expect(state.conjuntos).toHaveLength(1);
  });

  it('edita apenas observações sem trocar versão nem gerar transferência', async () => {
    const { state, seed, service } = fixture();
    const antigo = seed('a', ['imp-1']);
    const resultado = await service.update(antigo.id, { observacoes: 'Revisado', implementoIds: ['imp-1'] });
    expect(resultado).toMatchObject({ id: antigo.id, nome: antigo.nome, observacoes: 'Revisado' });
    expect(resultado.implementos[0].dataFim).toBeNull();
    expect(state.conjuntos).toHaveLength(1);
    expect(state.historicoImplemento).toHaveLength(0);
  });

  it('cria registro inativo sem tomar posse de implementos nem encerrar composições ativas', async () => {
    const { state, seed, service } = fixture();
    const antigo = seed('a', ['imp-1']);
    const novo = await service.create({ cavaloMecanicoId: 'b', implementoIds: ['imp-1'], status: StatusGeral.INATIVO });
    expect(state.conjuntos.find((item: any) => item.id === antigo.id).status).toBe('ATIVO');
    expect(novo.implementos[0]).toMatchObject({ dataInicio: timestamp, dataFim: timestamp });
    expect(state.historicoImplemento).toHaveLength(0);
  });

  it('exige justificativa válida para composições vazias e a preserva no histórico de criação', async () => {
    const { state, service } = fixture();
    await expect(service.create({ cavaloMecanicoId: 'a', implementoIds: [], justificativaSemImplemento: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    const novo = await service.create({ cavaloMecanicoId: 'a', implementoIds: [], justificativaSemImplemento: 'Deslocamento sem carreta' });
    expect(novo).toMatchObject({ justificativaSemImplemento: 'Deslocamento sem carreta', quantidadeTotalEixos: 0 });
    expect(state.historicoConjuntoOperacional[0].dadosDepois.justificativaSemImplemento).toBe('Deslocamento sem carreta');
  });

  it.each([
    ['duplicado', ['imp-1', 'imp-1']],
    ['não encontrado', ['desconhecido']],
    ['mais de duas carretas', ['imp-1', 'imp-2', 'imp-3']],
  ])('recusa implemento %s antes de encerrar qualquer vínculo', async (_caso, implementoIds) => {
    const { state, tx, seed, service } = fixture();
    seed('a', ['imp-1']);
    const before = clone(state);
    await expect(service.create({ cavaloMecanicoId: 'b', implementoIds })).rejects.toBeInstanceOf(BadRequestException);
    expect(state).toEqual(before);
    expect(tx.conjuntoImplemento.updateMany).not.toHaveBeenCalled();
  });

  it('desfaz encerramento, nova composição e histórico se o histórico da transferência falhar', async () => {
    const { state, tx, seed, service } = fixture();
    seed('a', ['imp-1']);
    const before = clone(state);
    tx.historicoImplemento.create.mockRejectedValueOnce(new Error('Histórico indisponível'));
    await expect(service.create({ cavaloMecanicoId: 'b', implementoIds: ['imp-1'] })).rejects.toThrow('Histórico indisponível');
    expect(state).toEqual(before);
    expect(tx.conjunto.create).toHaveBeenCalled();
  });

  it('recusa exclusão de conjuntos com vínculos mesmo sem histórico nem lançamentos', async () => {
    const { state, tx, seed, service } = fixture();
    const antigo = seed('a', ['imp-1']);
    await expect(service.remove(antigo.id)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.conjunto.delete).not.toHaveBeenCalled();
    expect(state.conjuntos).toHaveLength(1);
    expect(state.conjuntos[0].implementos[0].dataFim).toBeNull();
  });

  it('retorna não encontrado ao editar ou excluir composição inexistente', async () => {
    const { service } = fixture();
    await expect(service.update('inexistente', { observacoes: 'Teste' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('inexistente')).rejects.toBeInstanceOf(NotFoundException);
  });
});
