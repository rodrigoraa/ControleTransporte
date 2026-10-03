import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AbastecimentosController } from './abastecimentos.controller';
import { AbastecimentosService } from './abastecimentos.service';

describe('AbastecimentosController HTTP', () => {
  const cavalo = { id: 'cav-1', placa: 'QAV0D73' };
  const prisma: any = {
    cavaloMecanico: { findUnique: jest.fn() },
    abastecimento: { findMany: jest.fn(), count: jest.fn() },
  };
  const service = new AbastecimentosService(prisma);
  const findAll = jest.spyOn(service, 'findAll');
  const findByCavalo = jest.spyOn(service, 'findByCavalo');
  let app: NestFastifyApplication;

  @Module({
    controllers: [AbastecimentosController],
    providers: [
      { provide: AbastecimentosService, useValue: service },
    ],
  })
  class TestAppModule {}

  beforeAll(async () => {
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockReturnValue(true);
    jest.spyOn(RolesGuard.prototype, 'canActivate').mockReturnValue(true);
    app = await NestFactory.create<NestFastifyApplication>(TestAppModule, new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.cavaloMecanico.findUnique.mockResolvedValue(cavalo);
    prisma.abastecimento.findMany.mockResolvedValue([]);
    prisma.abastecimento.count.mockResolvedValue(0);
  });

  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  it('aceita todos os filtros enviados pela tabela e transforma números sem rejeitar os parâmetros', async () => {
    const query = new URLSearchParams({
      page: '2',
      limit: '10',
      search: 'QAV0D73',
      data: '2026-09-28',
      cavalo: 'QAV0D73',
      kmAnterior: '566357',
      kmAtual: '567101',
      distanciaPercorrida: '744',
      litros: '389',
      mediaKmLitro: '1.913',
    });

    const response = await app.inject({ method: 'GET', url: `/api/abastecimentos?${query}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [], total: 0, page: 2, limit: 10 });
    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      limit: 10,
      search: 'QAV0D73',
      data: '2026-09-28',
      cavalo: 'QAV0D73',
      kmAnterior: 566357,
      kmAtual: 567101,
      distanciaPercorrida: 744,
      litros: 389,
      mediaKmLitro: 1.913,
    }));
    expect(findByCavalo).not.toHaveBeenCalled();
    const listQuery = prisma.abastecimento.findMany.mock.calls[0][0];
    expect(listQuery).toMatchObject({ skip: 10, take: 10, include: { cavaloMecanico: true } });
    expect(prisma.abastecimento.count).toHaveBeenCalledWith({ where: listQuery.where });
  });

  it('mantém a resposta de histórico ao informar cavaloMecanicoId', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/abastecimentos?cavaloMecanicoId=cav-1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      cavalo,
      registros: [],
      divergencias: [],
      resumo: { quantidadeRegistros: 0, ultimaQuilometragem: null, kmAnteriorSugerido: null },
    });
    expect(findByCavalo).toHaveBeenCalledWith('cav-1');
    expect(findAll).not.toHaveBeenCalled();
    expect(prisma.abastecimento.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { cavaloMecanicoId: 'cav-1' } }));
    expect(prisma.abastecimento.count).not.toHaveBeenCalled();
  });

  it.each([
    'kmAnterior=texto',
    'litros=-1',
    'filtroDesconhecido=1',
  ])('rejeita filtro inválido antes de consultar o banco: %s', async (query) => {
    const response = await app.inject({ method: 'GET', url: `/api/abastecimentos?${query}` });

    expect(response.statusCode).toBe(400);
    expect(findAll).not.toHaveBeenCalled();
    expect(prisma.abastecimento.findMany).not.toHaveBeenCalled();
    expect(prisma.abastecimento.count).not.toHaveBeenCalled();
  });
});
