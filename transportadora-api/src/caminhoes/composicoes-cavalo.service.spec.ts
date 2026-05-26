import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, TipoCavaloMecanico, TipoImplemento } from '@prisma/client';
import { ComposicoesCavaloService } from './composicoes-cavalo.service';

describe('ComposicoesCavaloService', () => {
  const service = new ComposicoesCavaloService();

  it('calcula total de eixos e tipo de rodotrem 11 eixos', async () => {
    const tx: any = {
      conjunto: {
        create: jest.fn(async ({ data }: any) => ({ id: 'conj-1', ...data })),
      },
      historicoConjuntoOperacional: { create: jest.fn(async (args: any) => args) },
    };

    const conjunto = await service.createConjunto(
      tx,
      { id: 'cav-1', placa: 'ABC1D23', marca: 'Volvo', tipoCavalo: TipoCavaloMecanico.TRUCADO_6X2 },
      [
        { id: 'imp-1', tipo: TipoImplemento.CARRETA, quantidadeEixos: 3, capacidadeCarga: new Prisma.Decimal(30000) },
        { id: 'imp-2', tipo: TipoImplemento.DOLLY, quantidadeEixos: 2, capacidadeCarga: new Prisma.Decimal(0) },
        { id: 'imp-3', tipo: TipoImplemento.CARRETA, quantidadeEixos: 3, capacidadeCarga: new Prisma.Decimal(30000) },
      ],
      'ATIVO',
      null,
      new Date('2026-05-25T00:00:00.000Z'),
    );

    expect(conjunto.quantidadeTotalEixos).toBe(11);
    expect(conjunto.tipo).toBe('RODOTREM');
    expect(tx.historicoConjuntoOperacional.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ acao: 'CRIACAO_COMPOSICAO' }),
    }));
  });

  it('exige dolly quando houver segunda carreta', () => {
    expect(() => service.validateComposition([
      { tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 },
      { tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 },
    ], TipoCavaloMecanico.TRUCADO_6X2)).toThrow(BadRequestException);
  });

  it('converte erro de placa duplicada em conflito claro', async () => {
    const prisma: any = {
      $transaction: jest.fn(async () => {
        throw { code: 'P2002', meta: { target: ['placa'] } };
      }),
    };

    await expect(service.runCompositionTransaction(prisma, jest.fn())).rejects.toBeInstanceOf(ConflictException);
  });
});
