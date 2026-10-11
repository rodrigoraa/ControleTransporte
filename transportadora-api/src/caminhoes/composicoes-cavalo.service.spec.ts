import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, TipoCavaloMecanico, TipoImplemento } from '@prisma/client';
import { ComposicoesCavaloService } from './composicoes-cavalo.service';

describe('ComposicoesCavaloService', () => {
  const service = new ComposicoesCavaloService();

  it('calcula total de eixos e tipo de rodotrem 11 eixos', async () => {
    const tx: any = {
      conjunto: {
        findFirst: jest.fn(async () => null),
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

  it('permite bitrem com duas carretas sem dolly', () => {
    expect(() => service.validateComposition([
      { tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 },
      { tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 },
    ], TipoCavaloMecanico.TRUCADO_6X2)).not.toThrow();
  });

  it('classifica como bitrem o conjunto de 7 eixos sem dolly', async () => {
    const tx: any = {
      conjunto: { findFirst: jest.fn(async () => null), create: jest.fn(async ({ data }: any) => ({ id: 'conj-7', ...data })) },
      historicoConjuntoOperacional: { create: jest.fn() },
    };
    const conjunto = await service.createConjunto(tx, { id: 'cav-7', placa: 'BIT7EIX', marca: 'Teste', tipoCavalo: TipoCavaloMecanico.TRUCADO_6X2 }, [
      { id: 'imp-1', tipo: TipoImplemento.CARRETA, quantidadeEixos: 2, capacidadeCarga: new Prisma.Decimal(30000) },
      { id: 'imp-2', tipo: TipoImplemento.CARRETA, quantidadeEixos: 2, capacidadeCarga: new Prisma.Decimal(30000) },
    ], 'ATIVO', null, new Date('2026-07-20'));
    expect(conjunto.quantidadeTotalEixos).toBe(7);
    expect(conjunto.tipo).toBe('BITREM');
  });

  it('rejeita mais de um dolly', () => {
    expect(() => service.validateComposition([
      { tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 },
      { tipo: TipoImplemento.DOLLY, quantidadeEixos: 2 },
      { tipo: TipoImplemento.DOLLY, quantidadeEixos: 2 },
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

  it('repete a transação inteira em caso de conflito de serialização', async () => {
    const callback = jest.fn(async () => 'ok');
    const prisma: any = {
      $transaction: jest.fn()
        .mockRejectedValueOnce({ code: 'P2034' })
        .mockImplementation(async (execute: any) => execute({})),
    };
    await expect(service.runCompositionTransaction(prisma, callback)).resolves.toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(callback, expect.objectContaining({ isolationLevel: 'Serializable' }));
  });

  it('retorna conflito após esgotar tentativas concorrentes', async () => {
    const prisma: any = { $transaction: jest.fn().mockRejectedValue({ code: 'P2034' }) };
    await expect(service.runCompositionTransaction(prisma, jest.fn())).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(4);
  });

  it('não repete falhas operacionais nem erros de referência', async () => {
    const falha = new Error('Falha no histórico');
    const prisma: any = { $transaction: jest.fn().mockRejectedValue(falha) };
    await expect(service.runCompositionTransaction(prisma, jest.fn())).rejects.toBe(falha);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    prisma.$transaction.mockRejectedValue({ code: 'P2003' });
    await expect(service.runCompositionTransaction(prisma, jest.fn())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloqueia um vínculo simultâneo detectado antes de criar o conjunto', async () => {
    const tx: any = { conjunto: { findFirst: jest.fn().mockResolvedValue({ id: 'outro' }), create: jest.fn() } };
    await expect(service.createConjunto(tx, { id: 'cav', placa: 'ABC1D23', marca: null }, [
      { id: 'imp', tipo: TipoImplemento.CARRETA, quantidadeEixos: 2, capacidadeCarga: new Prisma.Decimal(10) },
    ], 'ATIVO', null, new Date())).rejects.toBeInstanceOf(ConflictException);
    expect(tx.conjunto.create).not.toHaveBeenCalled();
  });

  it('fecha vínculos de uma composição não ativa no mesmo instante inicial', async () => {
    const tx: any = {
      conjunto: { findFirst: jest.fn(), create: jest.fn(async ({ data }: any) => ({ id: 'inativo', ...data })) },
      historicoConjuntoOperacional: { create: jest.fn() },
    };
    const timestamp = new Date('2026-10-11T12:00:00Z');
    await service.createConjunto(tx, { id: 'cav', placa: 'ABC1D23', marca: null }, [
      { id: 'imp', tipo: TipoImplemento.CARRETA, quantidadeEixos: 2, capacidadeCarga: new Prisma.Decimal(10) },
    ], 'MANUTENCAO', null, timestamp);
    expect(tx.conjunto.findFirst).not.toHaveBeenCalled();
    expect(tx.conjunto.create.mock.calls[0][0].data.implementos.create).toEqual([
      { implementoId: 'imp', ordem: 1, dataInicio: timestamp, dataFim: timestamp },
    ]);
  });

  it.each([
    ['dolly isolado', [{ tipo: TipoImplemento.DOLLY, quantidadeEixos: 2 }]],
    ['carreta com dolly', [{ tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 }, { tipo: TipoImplemento.DOLLY, quantidadeEixos: 2 }]],
    ['mais de duas carretas', Array.from({ length: 3 }, () => ({ tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 }))],
    ['eixos inválidos', [{ tipo: TipoImplemento.SEMIRREBOQUE, quantidadeEixos: 4 }]],
    ['ordem inválida', [{ tipo: TipoImplemento.DOLLY, quantidadeEixos: 2 }, { tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 }, { tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 }]],
    ['implemento repetido', [{ id: 'imp', tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 }, { id: 'imp', tipo: TipoImplemento.CARRETA, quantidadeEixos: 2 }]],
  ])('preserva validação: %s', (_caso, implementos) => {
    expect(() => service.validateComposition(implementos, TipoCavaloMecanico.TRUCADO_6X2)).toThrow(BadRequestException);
  });
});




