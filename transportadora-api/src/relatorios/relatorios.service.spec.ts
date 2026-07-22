import { TipoComissao, TipoLancamento } from '@prisma/client';
import { RelatoriosService } from './relatorios.service';

function makeService() {
  const faturamento = {
    id: 'lan-2',
    data: new Date('2026-05-11T12:00:00.000Z'),
    createdAt: new Date('2026-05-11T12:00:00.000Z'),
    tipoLancamento: TipoLancamento.FATURAMENTO,
    placa: 'ABC1D23',
    descricao: 'Frete',
    quantidade: 20,
    unidadeQuantidade: 'KG',
    valorUnitario: 8,
    valorTotal: 160,
    tipoComissao: TipoComissao.PERCENTUAL,
    percentualComissao: 12,
    valorComissaoPorViagem: 240,
    valorComissao: 19.2,
    quantidadeEixosComissao: 7,
    faturamentoOrigemId: null,
    faturamentoOrigem: null,
    despesaComissao: { id: 'lan-3', categoriaId: 'cat-comissao' },
    motoristaId: 'mot-1',
    motorista: { nome: 'Carlos Almeida' },
    fornecedor: null,
    cliente: { nome: 'Cliente Teste' },
    categoriaFinanceira: { nome: 'Frete' },
    cavaloMecanicoId: 'cav-1',
    conjuntoId: 'conj-1',
    cavaloMecanico: { placa: 'ABC1D23', marca: 'Volvo', modelo: 'FH' },
    conjunto: {
      nome: 'Bitrem graneleiro',
      tipo: 'BITREM',
      quantidadeTotalEixos: 7,
      capacidadeTotal: 64000,
      implementos: [{ ordem: 1, implemento: { placa: 'CAR1A01', tipo: 'SEMIRREBOQUE', carroceria: 'GRANELEIRO', quantidadeEixos: 3 } }],
    },
    implemento: null,
  };
  const lancamentos = [
    {
      id: 'lan-1',
      data: new Date('2026-05-10T12:00:00.000Z'),
      createdAt: new Date('2026-05-10T12:00:00.000Z'),
      tipoLancamento: TipoLancamento.DESPESA,
      placa: 'ABC1D23',
      descricao: 'Abastecimento',
      quantidade: 10,
      unidadeQuantidade: 'KG',
      valorUnitario: 5,
      valorTotal: 50,
      tipoComissao: null,
      percentualComissao: null,
      valorComissaoPorViagem: null,
      valorComissao: null,
      quantidadeEixosComissao: null,
      faturamentoOrigemId: null,
      faturamentoOrigem: null,
      despesaComissao: null,
      motoristaId: 'mot-1',
      motorista: { nome: 'Carlos Almeida' },
      fornecedor: { nome: 'Posto Rota Pesada' },
      cliente: null,
      categoriaFinanceira: { nome: 'Combustível' },
      cavaloMecanicoId: 'cav-1',
      conjuntoId: 'conj-1',
      cavaloMecanico: { placa: 'ABC1D23', marca: 'Volvo', modelo: 'FH' },
      conjunto: {
        nome: 'Bitrem graneleiro',
        tipo: 'BITREM',
        quantidadeTotalEixos: 7,
        capacidadeTotal: 64000,
        implementos: [{ ordem: 1, implemento: { placa: 'CAR1A01', tipo: 'SEMIRREBOQUE', carroceria: 'GRANELEIRO', quantidadeEixos: 3 } }],
      },
      implemento: null,
    },
    faturamento,
    {
      id: 'lan-3',
      data: new Date('2026-05-11T12:00:00.000Z'),
      createdAt: new Date('2026-05-11T12:00:00.000Z'),
      tipoLancamento: TipoLancamento.DESPESA,
      placa: 'ABC1D23',
      descricao: 'Comissão de motorista (12%) - 7 eixos',
      quantidade: 1,
      unidadeQuantidade: 'UNIDADE',
      valorUnitario: 19.2,
      valorTotal: 19.2,
      tipoComissao: null,
      percentualComissao: null,
      valorComissaoPorViagem: null,
      valorComissao: null,
      quantidadeEixosComissao: null,
      faturamentoOrigemId: 'lan-2',
      faturamentoOrigem: { id: 'lan-2' },
      despesaComissao: null,
      motoristaId: 'mot-1',
      motorista: { nome: 'Carlos Almeida' },
      fornecedor: null,
      cliente: null,
      categoriaFinanceira: { nome: 'Comissão de motorista' },
      cavaloMecanicoId: 'cav-1',
      conjuntoId: 'conj-1',
      cavaloMecanico: { placa: 'ABC1D23', marca: 'Volvo', modelo: 'FH' },
      conjunto: faturamento.conjunto,
      implemento: null,
    },
  ];
  const abastecimentos = [{
    id: 'ab-1',
    data: new Date('2026-05-12T12:00:00.000Z'),
    cavaloMecanicoId: 'cav-1',
    kmAnterior: 100000,
    kmAtual: 100750,
    distanciaPercorrida: 750,
    litros: 250,
    mediaKmLitro: 3,
    observacoes: 'Viagem completa',
    createdAt: new Date('2026-05-12T12:00:00.000Z'),
    cavaloMecanico: { id: 'cav-1', placa: 'ABC1D23', marca: 'Volvo', modelo: 'FH' },
  }];

  const prisma = {
    conjuntoImplemento: {
      findMany: jest.fn(async () => [{ conjuntoId: 'conj-1' }]),
    },
    lancamentoFinanceiro: {
      aggregate: jest.fn(async ({ where, _sum }: any) => {
        if (_sum?.valorComissao) {
          return { _count: { _all: 1 }, _sum: { valorTotal: 160, valorComissao: 19.2 } };
        }
        return { _sum: { valorTotal: where.tipoLancamento === TipoLancamento.DESPESA ? 69.2 : 160 } };
      }),
      count: jest.fn(async () => lancamentos.length),
      findMany: jest.fn(async ({ where }: any = {}) => (
        JSON.stringify(where || {}).includes('tipoComissao') ? [faturamento] : lancamentos
      )),
      groupBy: jest.fn(async ({ by, where }: any) => [{
        [by[0]]: by[0] === 'motoristaId' ? 'mot-1' : 'cav-1',
        _sum: { valorTotal: where.tipoLancamento === TipoLancamento.DESPESA ? 69.2 : 160 },
      }]),
    },
    abastecimento: {
      aggregate: jest.fn(async () => ({
        _count: { _all: abastecimentos.length },
        _sum: { distanciaPercorrida: 750, litros: 250 },
      })),
      groupBy: jest.fn(async () => [{
        cavaloMecanicoId: 'cav-1',
        _count: { _all: abastecimentos.length },
        _sum: { distanciaPercorrida: 750, litros: 250 },
      }]),
      findMany: jest.fn(async () => abastecimentos),
    },
    cavaloMecanico: {
      findMany: jest.fn(async () => [{ id: 'cav-1', placa: 'ABC1D23', marca: 'Volvo', modelo: 'FH' }]),
    },
    motorista: {
      findMany: jest.fn(async () => [{ id: 'mot-1', nome: 'Carlos Almeida', cpf: '123' }]),
    },
  } as any;

  return { service: new RelatoriosService(prisma), prisma, lancamentos };
}

describe('RelatoriosService', () => {
  it('gera relatório financeiro e contabiliza a comissão uma única vez como despesa', async () => {
    const { service, prisma } = makeService();

    const result = await service.financeiros({
      dataInicial: '2026-05-01',
      dataFinal: '2026-05-31',
      cavaloMecanicoId: 'cav-1',
      placa: 'ABC1D23',
      implementoId: 'imp-1',
      tipoConjunto: 'BITREM',
      quantidadeEixos: 7,
      page: 2,
      limit: 1,
      orderBy: 'valorTotal',
      orderDirection: 'asc',
    } as any);

    expect(result.totalDespesas).toBe(69.2);
    expect(result.totalFaturamento).toBe(160);
    expect(result.saldoFinal).toBe(90.8);
    expect(result.comissoes.resumo).toEqual({
      quantidade: 1,
      totalFaturado: 160,
      totalComissoes: 19.2,
      faturamentoAposComissoes: 140.8,
    });
    expect(result.comissoes.historico).toHaveLength(1);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(1);
    expect(result.conjuntosPorCavalo[0]).toMatchObject({
      cavalo: 'ABC1D23 - Volvo - FH',
      conjunto: 'Bitrem graneleiro',
      tipoConjunto: 'BITREM',
      quantidadeTotalEixos: 7,
      totalDespesas: 69.2,
      totalFaturamento: 160,
      saldo: 90.8,
    });
    expect(result.consumo.resumo).toEqual({
      quantidadeRegistros: 1,
      distanciaTotal: 750,
      litrosTotal: 250,
      mediaGeralKmLitro: 3,
    });
    expect(prisma.conjuntoImplemento.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { implementoId: 'imp-1' } }));
    const paginatedCall = prisma.lancamentoFinanceiro.findMany.mock.calls.find(([args]: any[]) => args.skip === 1);
    expect(paginatedCall?.[0]).toEqual(expect.objectContaining({
      skip: 1,
      take: 1,
      orderBy: { valorTotal: 'asc' },
    }));
    const commissionCall = prisma.lancamentoFinanceiro.findMany.mock.calls.find(([args]: any[]) => JSON.stringify(args.where).includes('tipoComissao'));
    expect(JSON.stringify(commissionCall?.[0].where)).toContain('quantidadeEixosComissao');
    expect(prisma.abastecimento.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        cavaloMecanicoId: 'cav-1',
        cavaloMecanico: { placa: { contains: 'ABC1D23', mode: 'insensitive' } },
        data: {
          gte: new Date('2026-05-01T00:00:00.000Z'),
          lte: new Date('2026-05-31T23:59:59.999Z'),
        },
      }),
    }));
  });

  it('exporta CSV com comissão detalhada sem duplicar o valor na linha da despesa automática', async () => {
    const { service, prisma } = makeService();

    const csv = await service.exportarCsv({ tipoLancamento: TipoLancamento.DESPESA });

    expect(csv).toContain('"Cavalo mecânico"');
    expect(csv).toContain('"Conjunto operacional"');
    expect(csv).toContain('"Implementos do conjunto"');
    expect(csv).toContain('"Resumo de comissões dos faturamentos"');
    expect(csv).toContain('"Histórico de comissões"');
    expect(csv).toContain('"Percentual"');
    expect(csv).toContain('"12,00%"');
    expect(csv).toContain('"19.2"');
    expect(csv).toContain('"Resumo de consumo por cavalo"');
    expect(csv).toContain('"Histórico de abastecimentos"');
    const commissionCall = prisma.lancamentoFinanceiro.findMany.mock.calls.find(([args]: any[]) => JSON.stringify(args.where).includes('tipoComissao'));
    const commissionWhere = JSON.stringify(commissionCall?.[0].where);
    expect(commissionWhere).toContain('FATURAMENTO');
    expect(commissionWhere).not.toContain('DESPESA');
  });

  it('exporta PDF válido com as seções financeira, comissão e consumo', async () => {
    const { service } = makeService();

    const pdf = await service.exportarPdf({ tipoLancamento: TipoLancamento.FATURAMENTO });

    expect(pdf.toString('utf8', 0, 8)).toBe('%PDF-1.4');
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.toString('latin1')).toContain('/Encoding /WinAnsiEncoding');
    expect(pdf.toString('latin1')).toContain('Lançamentos encontrados');
    expect(pdf.toString('latin1')).toContain('Resumo por composição do cavalo');
    expect(pdf.toString('latin1')).toContain('Comissões dos faturamentos');
    expect(pdf.toString('latin1')).toContain('Percentual');
    expect(pdf.toString('latin1')).toContain('Consumo dos cavalos');
    expect(pdf.toString('latin1')).toContain('Histórico de abastecimentos');
  });
});
