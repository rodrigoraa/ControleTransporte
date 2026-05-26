import { BadRequestException } from '@nestjs/common';
import { Prisma, StatusGeral, TipoCavaloMecanico, TipoImplemento } from '@prisma/client';
import { CaminhoesService } from './caminhoes.service';
import { ComposicoesCavaloService } from './composicoes-cavalo.service';

function makePrisma() {
  const state: any = {
    cavalo: {
      id: 'cav-1',
      placa: 'ABC1D23',
      marca: 'Volvo',
      modelo: 'FH',
      tipoCavalo: TipoCavaloMecanico.TRUCADO_6X2,
      motoristaId: 'mot-1',
    },
    implementos: [] as any[],
    conjuntos: [] as any[],
  };

  const tx: any = {
    cavaloMecanico: {
      create: jest.fn(async ({ data }: any) => ({ id: 'cav-1', ...data, motorista: null })),
      update: jest.fn(async ({ data }: any) => {
        state.cavalo = { ...state.cavalo, ...data };
        return { ...state.cavalo, motorista: null };
      }),
      findUniqueOrThrow: jest.fn(async () => ({ ...state.cavalo, conjuntos: state.conjuntos.filter((item: any) => item.status === StatusGeral.ATIVO), motorista: null })),
    },
    implemento: {
      create: jest.fn(async ({ data }: any) => {
        const item = { id: `imp-${state.implementos.length + 1}`, ...data };
        state.implementos.push(item);
        return item;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const current = state.implementos.find((item: any) => item.id === where.id);
        Object.assign(current, data);
        return current;
      }),
    },
    conjunto: {
      create: jest.fn(async ({ data }: any) => {
        const conjunto = {
          id: `conj-${state.conjuntos.length + 1}`,
          ...data,
          implementos: data.implementos.create.map((item: any, index: number) => ({
            ...item,
            ordem: index + 1,
            implemento: state.implementos.find((implemento: any) => implemento.id === item.implementoId),
          })),
          cavaloMecanico: state.cavalo,
        };
        state.conjuntos.push(conjunto);
        return conjunto;
      }),
      findMany: jest.fn(async () => state.conjuntos.filter((item: any) => item.status === StatusGeral.ATIVO)),
      update: jest.fn(async ({ where, data }: any) => {
        const conjunto = state.conjuntos.find((item: any) => item.id === where.id);
        Object.assign(conjunto, data);
        return conjunto;
      }),
    },
    conjuntoImplemento: { updateMany: jest.fn(async () => ({ count: 1 })) },
    historicoConjuntoOperacional: { create: jest.fn(async (args: any) => args) },
    historicoCavaloMecanico: { create: jest.fn(async (args: any) => args) },
  };

  return {
    state,
    tx,
    prisma: {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
      auditoria: { create: jest.fn(async (args: any) => args) },
      historicoMotorista: { create: jest.fn(async (args: any) => args) },
      historicoCavaloMecanico: { create: jest.fn(async (args: any) => args) },
      historicoConjuntoOperacional: { create: jest.fn(async (args: any) => args) },
      cavaloMecanico: {
        findUnique: jest.fn(async () => state.cavalo),
      },
      conjunto: {
        findMany: jest.fn(async () => state.conjuntos),
      },
      lancamentoFinanceiro: {
        findMany: jest.fn(async () => []),
      },
    } as any,
  };
}

describe('CaminhoesService', () => {
  const makeService = (prisma: any) => new CaminhoesService(prisma, new ComposicoesCavaloService());

  it('cria cavalo com carreta e calcula total de eixos incluindo o cavalo', async () => {
    const { prisma, tx } = makePrisma();
    const service = makeService(prisma);

    const result = await service.create({
      placa: 'ABC1D23',
      marca: 'Volvo',
      modelo: 'FH',
      tipoCavalo: TipoCavaloMecanico.TRUCADO_6X2,
      implementos: [
        { placa: 'CAR1A01', tipo: TipoImplemento.CARRETA, carroceria: 'GRANELEIRO' as any, quantidadeEixos: 3, capacidadeCarga: 30000 },
      ],
    });

    expect(result.conjuntoAtual.quantidadeTotalEixos).toBe(6);
    expect(result.conjuntoAtual.tipo).toBe('SIMPLES');
    expect(tx.conjunto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        quantidadeTotalEixos: 6,
        capacidadeTotal: expect.any(Prisma.Decimal),
      }),
    }));
  });

  it('encerra composicao anterior e cria nova composicao com dolly registrando historico', async () => {
    const { prisma, state, tx } = makePrisma();
    const service = makeService(prisma);
    state.implementos.push({ id: 'imp-1', placa: 'CAR1A01', tipo: TipoImplemento.CARRETA, quantidadeEixos: 3, capacidadeCarga: new Prisma.Decimal(30000) });
    state.conjuntos.push({ id: 'conj-1', nome: 'ABC1D23 - antiga', status: StatusGeral.ATIVO, cavaloMecanicoId: 'cav-1', implementos: [] });
    jest.spyOn(service as any, 'findOne').mockResolvedValue({ ...state.cavalo, conjuntos: state.conjuntos });

    const result = await service.update('cav-1', {
      implementos: [
        { id: 'imp-1', placa: 'CAR1A01', tipo: TipoImplemento.CARRETA, carroceria: 'GRANELEIRO' as any, quantidadeEixos: 2 },
        { placa: 'DOL1Y01', tipo: TipoImplemento.DOLLY, carroceria: 'OUTRO' as any, quantidadeEixos: 2 },
        { placa: 'CAR1A02', tipo: TipoImplemento.CARRETA, carroceria: 'GRANELEIRO' as any, quantidadeEixos: 2 },
      ],
    });

    expect(tx.conjuntoImplemento.updateMany).toHaveBeenCalled();
    expect(tx.historicoConjuntoOperacional.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ acao: 'ENCERRAMENTO_COMPOSICAO' }),
    }));
    expect(tx.historicoCavaloMecanico.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ acao: 'ALTERACAO_COMPOSICAO' }),
    }));
    expect(result.conjuntos[0].quantidadeTotalEixos).toBe(9);
    expect(result.conjuntos[0].tipo).toBe('RODOTREM');
  });

  it('bloqueia rodotrem com cavalo simples', async () => {
    const { prisma, state } = makePrisma();
    const service = makeService(prisma);
    state.cavalo.tipoCavalo = TipoCavaloMecanico.SIMPLES_TOCO_4X2;
    jest.spyOn(service as any, 'findOne').mockResolvedValue({ ...state.cavalo, conjuntos: [] });

    await expect(service.update('cav-1', {
      tipoCavalo: TipoCavaloMecanico.SIMPLES_TOCO_4X2,
      implementos: [
        { placa: 'CAR1A01', tipo: TipoImplemento.CARRETA, carroceria: 'GRANELEIRO' as any, quantidadeEixos: 2 },
        { placa: 'DOL1Y01', tipo: TipoImplemento.DOLLY, carroceria: 'OUTRO' as any, quantidadeEixos: 2 },
        { placa: 'CAR1A02', tipo: TipoImplemento.CARRETA, carroceria: 'GRANELEIRO' as any, quantidadeEixos: 2 },
      ],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});




