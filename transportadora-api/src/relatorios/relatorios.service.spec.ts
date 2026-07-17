import { TipoLancamento } from '@prisma/client';
import { RelatoriosService } from './relatorios.service';

function makeService() {
  const lancamentos = [
    {
      id: 'lan-1',
      data: new Date('2026-05-10T12:00:00.000Z'),
      tipoLancamento: TipoLancamento.DESPESA,
      placa: 'ABC1D23',
      descricao: 'Abastecimento',
      quantidade: 10,
      unidadeQuantidade: 'KG',
      valorUnitario: 5,
      valorTotal: 50,
      motorista: { nome: 'Carlos Almeida' },
      fornecedor: { nome: 'Posto Rota Pesada' },
      cliente: null,
      categoriaFinanceira: { nome: 'Combustivel' },
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
    {
      id: 'lan-2',
      data: new Date('2026-05-11T12:00:00.000Z'),
      tipoLancamento: TipoLancamento.FATURAMENTO,
      placa: 'ABC1D23',
      descricao: 'Frete',
      quantidade: 20,
      unidadeQuantidade: 'KG',
      valorUnitario: 8,
      valorTotal: 160,
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
    },
  ];

  const prisma = {
    conjuntoImplemento: {
      findMany: jest.fn(async () => [{ conjuntoId: 'conj-1' }]),
    },
    lancamentoFinanceiro: {
      aggregate: jest.fn(async ({ where }: any) => ({
        _sum: {
          valorTotal: where.tipoLancamento === TipoLancamento.DESPESA ? 50 : 160,
        },
      })),
      count: jest.fn(async () => lancamentos.length),
      findMany: jest.fn(async () => lancamentos),
      groupBy: jest.fn(async ({ by, where }: any) => [{
        [by[0]]: by[0] === 'motoristaId' ? 'mot-1' : 'cav-1',
        _sum: { valorTotal: where.tipoLancamento === TipoLancamento.DESPESA ? 50 : 160 },
      }]),
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
  it('gera relatório financeiro com totais, paginacao, ordenacao e filtro por implemento no conjunto', async () => {
    const { service, prisma } = makeService();

    const result = await service.financeiros({
      implementoId: 'imp-1',
      tipoConjunto: 'BITREM',
      quantidadeEixos: 6,
      page: 2,
      limit: 1,
      orderBy: 'valorTotal',
      orderDirection: 'asc',
    } as any);

    expect(result.totalDespesas).toBe(50);
    expect(result.totalFaturamento).toBe(160);
    expect(result.saldoFinal).toBe(110);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(1);
    expect(result.conjuntosPorCavalo).toHaveLength(1);
    expect(result.conjuntosPorCavalo[0]).toMatchObject({
      cavalo: 'ABC1D23 - Volvo - FH',
      conjunto: 'Bitrem graneleiro',
      tipoConjunto: 'BITREM',
      quantidadeTotalEixos: 7,
      totalDespesas: 50,
      totalFaturamento: 160,
      saldo: 110,
    });
    expect(prisma.conjuntoImplemento.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { implementoId: 'imp-1' } }));
    expect(prisma.lancamentoFinanceiro.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 1,
      take: 1,
      orderBy: { valorTotal: 'asc' },
    }));
    const where = prisma.lancamentoFinanceiro.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('imp-1');
    expect(JSON.stringify(where)).toContain('conj-1');
    expect(JSON.stringify(where)).toContain('BITREM');
  });

  it('exporta CSV com cavalo, conjunto e totais financeiros', async () => {
    const { service } = makeService();

    const csv = await service.exportarCsv({ tipoLancamento: TipoLancamento.DESPESA });

    expect(csv).toContain('"Cavalo mecânico"');
    expect(csv).toContain('"Conjunto operacional"');
    expect(csv).toContain('"Implementos do conjunto"');
    expect(csv).toContain('"ABC1D23"');
    expect(csv).toContain('"Bitrem graneleiro"');
    expect(csv).toContain('"1. CAR1A01 SEMIRREBOQUE GRANELEIRO 3 eixos"');
    expect(csv).toContain('"50"');
  });

  it('exporta PDF valido com linhas do relatório', async () => {
    const { service } = makeService();

    const pdf = await service.exportarPdf({ tipoLancamento: TipoLancamento.FATURAMENTO });

    expect(pdf.toString('utf8', 0, 8)).toBe('%PDF-1.4');
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.toString('latin1')).toContain('/Encoding /WinAnsiEncoding');
    expect(pdf.toString('latin1')).toContain('Lançamentos encontrados');
    expect(pdf.toString('latin1')).toContain('Resumo por composição do cavalo');
  });
});




