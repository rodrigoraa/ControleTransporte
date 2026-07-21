import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AbastecimentosService } from './abastecimentos.service';

describe('AbastecimentosService', () => {
  const cavalo = { id: 'cav-1', placa: 'ABC1D23' };
  const prisma: any = {
    cavaloMecanico: { count: jest.fn(async () => 1), findUnique: jest.fn(async () => cavalo) },
    abastecimento: { create: jest.fn(), findMany: jest.fn() },
    auditoria: { create: jest.fn() },
  };
  const service = new AbastecimentosService(prisma);

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
});
