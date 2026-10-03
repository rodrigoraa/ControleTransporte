import { Prisma } from '@prisma/client';
import { RelatoriosService } from './relatorios.service';

const reportType = 'ULTIMAS_MEDIAS_FROTA' as const;

function makeLatestService() {
  const registros = [{
    id: 'ab-abc', cavaloMecanicoId: 'cav-abc', placa: 'ABC1D23', marca: 'Volvo', modelo: 'FH',
    data: new Date('2026-09-26T00:00:00.000Z'),
    kmAnterior: new Prisma.Decimal('566357'), kmAtual: new Prisma.Decimal('567101'),
    distanciaPercorrida: new Prisma.Decimal('744'), litros: new Prisma.Decimal('389.001'),
    mediaKmLitro: new Prisma.Decimal('1.913'), observacoes: null,
  }, {
    id: 'ab-qav', cavaloMecanicoId: 'cav-qav', placa: 'QAV0D73', marca: null, modelo: null,
    data: new Date('2026-09-28T00:00:00.000Z'),
    kmAnterior: new Prisma.Decimal('100000.1'), kmAtual: new Prisma.Decimal('102000.3'),
    distanciaPercorrida: new Prisma.Decimal('2000.2'), litros: new Prisma.Decimal('786.432'),
    mediaKmLitro: new Prisma.Decimal('3.141'), observacoes: 'Média registrada',
  }];
  const prisma: any = {
    $queryRaw: jest.fn(async () => registros),
    cavaloMecanico: { findMany: jest.fn(async () => registros.map(({ cavaloMecanicoId, placa, marca, modelo }) => ({ id: cavaloMecanicoId, placa, marca, modelo }))) },
    abastecimento: { findMany: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
    lancamentoFinanceiro: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
  };
  return { prisma, registros, service: new RelatoriosService(prisma) };
}

describe('Relatórios - últimas médias da frota', () => {
  it('consulta apenas um registro por cavalo no banco com desempates determinísticos e ordem de placa', async () => {
    const { service, prisma } = makeLatestService();
    const result = await service.financeiros({ tipoRelatorio: reportType, page: 2, limit: 1, orderBy: 'data', orderDirection: 'desc' });
    const sql = prisma.$queryRaw.mock.calls[0][0].text.replace(/\s+/g, ' ').trim();

    expect(sql).toContain('JOIN LATERAL (');
    expect(sql).toContain('WHERE a."cavaloMecanicoId" = c."id"');
    expect(sql).toContain('ORDER BY a."data" DESC, a."createdAt" DESC, a."id" DESC LIMIT 1');
    expect(sql).toContain('ORDER BY c."placa" ASC, c."id" ASC');
    expect(sql).not.toContain('OFFSET');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.abastecimento.findMany).not.toHaveBeenCalled();
    expect(prisma.abastecimento.aggregate).not.toHaveBeenCalled();
    expect(prisma.abastecimento.groupBy).not.toHaveBeenCalled();
    expect(prisma.lancamentoFinanceiro.count).not.toHaveBeenCalled();
    expect(result.tipoRelatorio).toBe(reportType);
    expect(result.ultimasMedias.registros.map((item: any) => item.placa)).toEqual(['ABC1D23', 'QAV0D73']);
    expect(result.ultimasMedias.resumo).toEqual({
      cavalosComMedia: 2,
      dataMaisAntiga: new Date('2026-09-26T00:00:00.000Z'),
      dataMaisRecente: new Date('2026-09-28T00:00:00.000Z'),
    });
  });

  it('preserva a média persistida, mesmo quando difere da razão entre distância e litros', async () => {
    const { service } = makeLatestService();
    const result = await service.financeiros({ tipoRelatorio: reportType });
    expect(result.ultimasMedias.registros[1]).toMatchObject({
      id: 'ab-qav', cavaloMecanicoId: 'cav-qav', placa: 'QAV0D73', marca: null, modelo: null,
      kmAnterior: 100000.1, kmAtual: 102000.3, distanciaPercorrida: 2000.2, litros: 786.432,
      mediaKmLitro: 3.141, observacoes: 'Média registrada',
    });
    expect(result.ultimasMedias.registros[1].mediaKmLitro).not.toBeCloseTo(2000.2 / 786.432, 3);
  });

  it('combina filtros parametrizados de cavalos e placa e ignora datas e filtros financeiros', async () => {
    const { service, prisma } = makeLatestService();
    await service.financeiros({
      tipoRelatorio: reportType, cavaloMecanicoIds: ' cav-abc, cav-qav ', placa: 'QAV',
      dataInicial: '2020-01-01', dataFinal: '2020-01-02', motoristaId: 'mot-1', fornecedorId: 'for-1',
      clienteId: 'cli-1', categoriaId: 'cat-1', tipoLancamento: 'DESPESA', implementoId: 'imp-1',
    });
    const query = prisma.$queryRaw.mock.calls[0][0];
    expect(query.values).toEqual(['cav-abc', 'cav-qav', '%QAV%']);
    expect(query.text).toMatch(/c\."id" IN \(\$1,\s?\$2\)/);
    expect(query.text).toContain('c."placa" ILIKE $3');
    expect(query.text).not.toContain('2020');
    expect(query.text).not.toContain('lancamentos_financeiros');
    expect(query.text).not.toContain('"data" >=');
  });

  it('mantém valores de entrada como parâmetros, inclusive na consulta por ID singular', async () => {
    const { service, prisma } = makeLatestService();
    const cavaloMecanicoId = "cav-1' OR 1=1 --";
    const placa = "QAV' OR TRUE --";
    await service.financeiros({ tipoRelatorio: reportType, cavaloMecanicoId, placa });
    const query = prisma.$queryRaw.mock.calls[0][0];
    expect(query.values).toEqual([cavaloMecanicoId, `%${placa}%`]);
    expect(query.text).not.toContain(cavaloMecanicoId);
    expect(query.text).not.toContain(placa);
  });

  it('oferece somente cavalos com abastecimentos, considerando placa e sem restringir a faceta aos IDs selecionados', async () => {
    const { service, prisma } = makeLatestService();
    const options = await service.opcoes({
      tipoRelatorio: reportType, cavaloMecanicoId: 'cav-qav', cavaloMecanicoIds: 'cav-abc', placa: 'QAV',
      dataInicial: '2020-01-01', dataFinal: '2020-01-02', motoristaId: 'mot-1',
    });
    expect(prisma.cavaloMecanico.findMany).toHaveBeenCalledWith({
      where: { abastecimentos: { some: {} }, placa: { contains: 'QAV', mode: 'insensitive' } },
      select: { id: true, placa: true, marca: true, modelo: true },
      orderBy: [{ placa: 'asc' }, { id: 'asc' }],
    });
    expect(options.cavalosMecanicos).toEqual([
      { value: 'cav-abc', label: 'ABC1D23 - Volvo - FH' },
      { value: 'cav-qav', label: 'QAV0D73' },
    ]);
    expect(options.motoristas).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.abastecimento.findMany).not.toHaveBeenCalled();
  });

  it('exporta todas as últimas médias em CSV e PDF com a precisão dos registros e sem seções da média ponderada', async () => {
    const { service, prisma } = makeLatestService();
    const filters = { tipoRelatorio: reportType, page: 99, limit: 1 };
    const csv = await service.exportarCsv(filters);
    const pdf = (await service.exportarPdf(filters)).toString('latin1');

    expect(csv.startsWith('"Últimas médias da frota"')).toBe(true);
    expect(csv).toContain('"Placa";"Data";"Km anterior";"Km atual";"Distância";"Litros";"Última média km/l"');
    expect(csv).toContain('"ABC1D23";"2026-09-26";"566357.0";"567101.0";"744.0";"389.001";"1.913"');
    expect(csv).toContain('"QAV0D73";"2026-09-28";"100000.1";"102000.3";"2000.2";"786.432";"3.141"');
    expect(pdf).toContain('Últimas médias da frota');
    expect(pdf).toContain('Últimas médias por cavalo');
    expect(pdf).toContain('3,141 km/l');
    expect(pdf).toContain('/MediaBox [0 0 595 842]');
    for (const oldSection of ['Ranking da frota', 'Comparação com período anterior', 'Histórico de abastecimentos', 'Lançamentos encontrados']) {
      expect(csv).not.toContain(oldSection);
      expect(pdf).not.toContain(oldSection);
    }
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('respeita as colunas e a seção selecionadas nas duas exportações, incluindo parâmetros legados', async () => {
    const { service } = makeLatestService();
    const filters = { tipoRelatorio: reportType, secoes: 'ultimas_medias', colunas: 'ultimas_medias:placa,ultimas_medias:media' };
    const csv = await service.exportarCsv(filters);
    const pdf = (await service.exportarPdf({
      tipoRelatorio: reportType, secoesPdf: filters.secoes, colunasPdf: filters.colunas,
    })).toString('latin1');
    expect(csv).toContain('"Placa";"Última média km/l"');
    expect(csv).toContain('"QAV0D73";"3.141"');
    expect(csv).not.toContain('"Km anterior"');
    expect(pdf).toContain('(Placa) Tj');
    expect(pdf).toContain('(Última média) Tj');
    expect(pdf).not.toContain('(Data) Tj');
    expect(pdf).not.toContain('(Km anterior) Tj');
    const withoutSection = await service.exportarCsv({ ...filters, secoes: '' });
    expect(withoutSection).toBe('"Últimas médias da frota"');
  });

  it('representa resultados vazios sem médias ou datas artificiais nas respostas e exportações', async () => {
    const { service, prisma } = makeLatestService();
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await service.financeiros({ tipoRelatorio: reportType });
    expect(result.ultimasMedias).toEqual({
      registros: [], resumo: { cavalosComMedia: 0, dataMaisRecente: null, dataMaisAntiga: null },
    });
    expect(await service.exportarCsv({ tipoRelatorio: reportType })).toContain('Nenhum abastecimento encontrado');
    const pdf = (await service.exportarPdf({ tipoRelatorio: reportType })).toString('latin1');
    expect(pdf).toContain('Nenhum abastecimento encontrado');
    expect(pdf).not.toContain('0,000 km/l');
  });

  it('repete o cabeçalho em novas páginas e exporta todos os cavalos sem corte por paginação', async () => {
    const { service, prisma, registros } = makeLatestService();
    prisma.$queryRaw.mockResolvedValue(Array.from({ length: 80 }, (_, index) => ({
      ...registros[0], id: `ab-${index}`, cavaloMecanicoId: `cav-${index}`, placa: `CAR${String(index).padStart(4, '0')}`,
    })));
    const pdf = (await service.exportarPdf({ tipoRelatorio: reportType, page: 2, limit: 1 })).toString('latin1');
    expect(pdf.match(/\(Placa\) Tj/g)?.length).toBeGreaterThanOrEqual(3);
    expect(pdf).toContain('CAR0000');
    expect(pdf).toContain('CAR0079');
    expect(pdf).toContain('80 cavalos com média');
  });
});
