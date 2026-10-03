import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AbastecimentosService } from './abastecimentos.service';
import { AbastecimentosQueryDto } from './dto/abastecimentos-query.dto';

describe('AbastecimentosService', () => {
  const cavalo = { id: 'cav-1', placa: 'ABC1D23' };
  const prisma: any = {
    cavaloMecanico: { count: jest.fn(async () => 1), findUnique: jest.fn(async () => cavalo) },
    abastecimento: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    auditoria: { create: jest.fn() },
  };
  const service = new AbastecimentosService(prisma);

  async function listWhere(query: Partial<AbastecimentosQueryDto>) {
    prisma.abastecimento.findMany.mockResolvedValue([]);
    prisma.abastecimento.count.mockResolvedValue(0);
    await service.findAll(Object.assign(new AbastecimentosQueryDto(), query));
    return prisma.abastecimento.findMany.mock.calls[0][0].where;
  }

  const relatedFilter = (value: string) => ({
    is: { OR: ['placa', 'marca', 'modelo'].map((field) => ({ [field]: { contains: value, mode: 'insensitive' } })) },
  });

  const textSearch = (value: string) => [
    { observacoes: { contains: value, mode: 'insensitive' } },
    { cavaloMecanico: relatedFilter(value) },
  ];

  const dayFilter = {
    gte: new Date('2026-09-28T00:00:00.000Z'),
    lt: new Date('2026-09-29T00:00:00.000Z'),
  };

  beforeEach(() => jest.clearAllMocks());

  it('calcula distância e média no servidor ao criar', async () => {
    prisma.abastecimento.create.mockImplementation(async ({ data }: any) => ({ id: 'ab-1', ...data }));
    const result: any = await service.create({ cavaloMecanicoId: cavalo.id, data: new Date('2026-07-20'), kmAnterior: 100000, kmAtual: 100750, litros: 250 });
    expect(Number(result.distanciaPercorrida)).toBe(750);
    expect(Number(result.mediaKmLitro)).toBe(3);
  });

  it('rejeita km atual menor ou igual ao anterior', async () => {
    await expect(service.create({ cavaloMecanicoId: cavalo.id, data: new Date(), kmAnterior: 100, kmAtual: 100, litros: 20 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calcula média geral ponderada e sugere o último km atual', async () => {
    prisma.abastecimento.findMany.mockResolvedValue([
      { id: 'ab-2', kmAnterior: new Prisma.Decimal(600), kmAtual: new Prisma.Decimal(1500), distanciaPercorrida: new Prisma.Decimal(900), litros: new Prisma.Decimal(250) },
      { id: 'ab-1', kmAnterior: new Prisma.Decimal(0), kmAtual: new Prisma.Decimal(600), distanciaPercorrida: new Prisma.Decimal(600), litros: new Prisma.Decimal(200) },
    ]);
    const result: any = await service.findByCavalo(cavalo.id);
    expect(Number(result.resumo.mediaGeralKmLitro)).toBeCloseTo(3.333, 3);
    expect(Number(result.resumo.kmAnteriorSugerido)).toBe(1500);
    expect(result.divergencias).toEqual([]);
  });

  it('lista abastecimentos de forma paginada para a interface de gerenciamento', async () => {
    prisma.abastecimento.findMany.mockResolvedValue([{ id: 'ab-1', cavaloMecanico: cavalo }]);
    prisma.abastecimento.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result).toMatchObject({ total: 1, page: 1, limit: 10 });
    expect(prisma.abastecimento.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { cavaloMecanico: true },
      orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
    }));
  });

  it('combina a busca geral com os sete filtros e usa o mesmo critério na página e na contagem', async () => {
    prisma.abastecimento.findMany.mockResolvedValue([{ id: 'ab-1', cavaloMecanico: cavalo }]);
    prisma.abastecimento.count.mockResolvedValue(21);
    const query = Object.assign(new AbastecimentosQueryDto(), {
      page: 2,
      limit: 10,
      search: '  QAV0D73  ',
      data: '2026-09-28',
      cavalo: '  QAV  ',
      kmAnterior: 0,
      kmAtual: 567101,
      distanciaPercorrida: 744,
      litros: 389,
      mediaKmLitro: 1.913,
    });
    const where = {
      OR: textSearch('QAV0D73'),
      data: dayFilter,
      cavaloMecanico: relatedFilter('QAV'),
      kmAnterior: 0,
      kmAtual: 567101,
      distanciaPercorrida: 744,
      litros: 389,
      mediaKmLitro: 1.913,
    };

    await expect(service.findAll(query)).resolves.toMatchObject({ total: 21, page: 2, limit: 10 });
    expect(prisma.abastecimento.findMany).toHaveBeenCalledWith({
      where,
      include: { cavaloMecanico: true },
      skip: 10,
      take: 10,
      orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
    });
    expect(prisma.abastecimento.count).toHaveBeenCalledWith({ where });
  });

  it('busca placa, marca, modelo e observações sem diferenciar maiúsculas e ignora busca vazia', async () => {
    expect(await listWhere({ search: '  Volvo  ' })).toEqual({ OR: textSearch('Volvo') });
    jest.clearAllMocks();
    expect(await listWhere({ search: '   ', cavalo: '   ' })).toEqual({});
  });

  it.each(['774.001', '774,001'])('busca o valor numérico %s em todos os campos numéricos', async (search) => {
    const where = await listWhere({ search });
    expect(where.OR).toEqual([
      ...textSearch(search),
      ...['kmAnterior', 'kmAtual', 'distanciaPercorrida', 'litros', 'mediaKmLitro'].map((field) => ({
        [field]: new Prisma.Decimal('774.001'),
      })),
    ]);
  });

  it.each(['28/09/2026', '2026-09-28'])('busca a data completa %s na pesquisa geral', async (search) => {
    expect(await listWhere({ search })).toEqual({ OR: [...textSearch(search), { data: dayFilter }] });
  });

  it.each(['31/02/2026', '2026-02-29', '2026-13-01', '28/09', '774,001,2', '744km'])(
    'trata %s como texto sem produzir consultas de data ou número inválidas', async (search) => {
      expect(await listWhere({ search })).toEqual({ OR: textSearch(search) });
    },
  );

  it('normaliza uma data ISO com horário já aceita pelo DTO e rejeita dias inexistentes no filtro de data', async () => {
    expect(await listWhere({ data: '2026-09-28T14:30:00.000Z' })).toEqual({ data: dayFilter });
    jest.clearAllMocks();
    await expect(listWhere({ data: '2026-02-31' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.abastecimento.findMany).not.toHaveBeenCalled();
  });
});
