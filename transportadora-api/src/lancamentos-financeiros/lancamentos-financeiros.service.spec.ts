import { BadRequestException } from '@nestjs/common';
import { TipoLancamento, UnidadeQuantidade } from '@prisma/client';
import { LancamentosFinanceirosService } from './lancamentos-financeiros.service';

function makeService() {
  const create = jest.fn((args: any) => args);
  const update = jest.fn((args: any) => args);
  const findUnique = jest.fn(async ({ where }: any) => {
    if (where.placa === 'ABC1D23') return { id: 'horse-1', placa: 'ABC1D23', conjuntos: [{ id: 'set-1' }] };
    if (where.id === 'horse-1') return { id: 'horse-1', placa: 'ABC1D23', conjuntos: [{ id: 'set-1' }] };
    return null;
  });

  const prisma = {
    lancamentoFinanceiro: { create, update, findUnique: jest.fn() },
    cavaloMecanico: { findUnique },
    auditoria: { create: jest.fn() },
  } as any;

  const service = new LancamentosFinanceirosService(prisma);
  jest.spyOn(service as any, 'findOne').mockResolvedValue({
    id: 'launch-1',
    data: new Date('2026-01-01T00:00:00.000Z'),
    placa: 'ABC1D23',
    motoristaId: 'driver-1',
    fornecedorId: 'supplier-1',
    clienteId: null,
    tipoLancamento: TipoLancamento.DESPESA,
    quantidade: 2,
    valorUnitario: 10,
  });

  return { service, create, update, findUnique };
}

const baseDto = {
  data: new Date('2026-01-01T00:00:00.000Z'),
  placa: 'ABC1D23',
  motoristaId: 'driver-1',
  tipoLancamento: TipoLancamento.DESPESA,
  quantidade: 2,
  unidadeQuantidade: UnidadeQuantidade.UNIDADE,
  valorUnitario: 10,
};

describe('LancamentosFinanceirosService', () => {
  it('cria despesa com fornecedor, calcula valor total, zera cliente e vincula cavalo pela placa', async () => {
    const { service, create } = makeService();

    await service.create({ ...baseDto, fornecedorId: 'supplier-1', clienteId: 'client-1' });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        fornecedorId: 'supplier-1',
        clienteId: null,
        cavaloMecanicoId: 'horse-1',
        conjuntoId: 'set-1',
        valorTotal: expect.anything(),
      }),
    }));
    expect(String(create.mock.calls[0][0].data.valorTotal)).toBe('20');
  });

  it('cria despesa usando cavalo mecanico sem exigir placa no payload', async () => {
    const { service, create } = makeService();

    await service.create({
      ...baseDto,
      placa: undefined,
      cavaloMecanicoId: 'horse-1',
      fornecedorId: 'supplier-1',
    });

    expect(create.mock.calls[0][0].data.placa).toBe('ABC1D23');
    expect(create.mock.calls[0][0].data.cavaloMecanicoId).toBe('horse-1');
    expect(create.mock.calls[0][0].data.conjuntoId).toBe('set-1');
  });

  it('bloqueia despesa sem fornecedor', async () => {
    const { service } = makeService();

    await expect(service.create({ ...baseDto, fornecedorId: null })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cria faturamento com cliente e zera fornecedor', async () => {
    const { service, create } = makeService();

    await service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      clienteId: 'client-1',
      fornecedorId: 'supplier-1',
    });

    expect(create.mock.calls[0][0].data.clienteId).toBe('client-1');
    expect(create.mock.calls[0][0].data.fornecedorId).toBeNull();
  });

  it('bloqueia faturamento sem cliente', async () => {
    const { service } = makeService();

    await expect(service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      fornecedorId: 'supplier-1',
      clienteId: null,
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
