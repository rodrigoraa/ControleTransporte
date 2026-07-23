import { BadRequestException } from '@nestjs/common';
import { TipoComissao, TipoLancamento, UnidadeQuantidade } from '@prisma/client';
import { LancamentosFinanceirosService } from './lancamentos-financeiros.service';

function makeService(eixos = 6, currentOverrides: Record<string, any> = {}) {
  const create = jest.fn(async ({ data }: any) => ({
    id: data.faturamentoOrigemId ? 'commission-1' : 'launch-created',
    ...data,
    despesaComissao: null,
  }));
  const update = jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data }));
  const remove = jest.fn(async () => ({}));
  const findUnique = jest.fn(async ({ where }: any) => {
    if (where.id === 'horse-2') {
      return {
        id: 'horse-2',
        placa: 'XYZ9E99',
        conjuntos: [{ id: 'set-2', quantidadeTotalEixos: eixos }],
      };
    }
    if (where.placa === 'ABC1D23' || where.id === 'horse-1') {
      return {
        id: 'horse-1',
        placa: 'ABC1D23',
        conjuntos: [{ id: 'set-1', quantidadeTotalEixos: eixos }],
      };
    }
    return null;
  });

  const prisma: any = {
    lancamentoFinanceiro: { create, update, delete: remove, findUnique: jest.fn() },
    cavaloMecanico: { findUnique },
    conjunto: { findUnique: jest.fn() },
    categoriaFinanceira: {
      upsert: jest.fn(async () => ({ id: 'commission-category', codigoSistema: 'COMISSAO_MOTORISTA' })),
    },
    auditoria: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn(async (callback: (transaction: any) => Promise<any>) => callback(prisma));

  const service = new LancamentosFinanceirosService(prisma);
  const current = {
    id: 'launch-1',
    data: new Date('2026-01-01T00:00:00.000Z'),
    placa: 'ABC1D23',
    motoristaId: 'driver-1',
    fornecedorId: 'supplier-1',
    clienteId: null,
    tipoLancamento: TipoLancamento.DESPESA,
    quantidade: 2,
    valorUnitario: 10,
    multiplicarQuantidade: true,
    cavaloMecanicoId: 'horse-1',
    conjuntoId: 'set-1',
    conjunto: { quantidadeTotalEixos: eixos },
    faturamentoOrigemId: null,
    despesaComissao: null,
    tipoComissao: null,
    percentualComissao: null,
    valorComissaoPorViagem: null,
    descontoImpostos: false,
    valorComissaoBruta: null,
    valorDescontoImpostos: null,
    valorComissao: null,
    quantidadeEixosComissao: null,
    ...currentOverrides,
  };
  jest.spyOn(service as any, 'findOne').mockResolvedValue(current);

  return { service, prisma, create, update, remove, findUnique, current };
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
  it('busca o texto em todos os dados relacionados do lançamento', () => {
    const { service } = makeService();

    const where = (service as any).buildWhere({
      search: '  Edinaldo  ',
      tipoLancamento: TipoLancamento.DESPESA,
    });

    expect(where.tipoLancamento).toBe(TipoLancamento.DESPESA);
    expect(where.OR).toEqual(expect.arrayContaining([
      { descricao: { contains: 'Edinaldo', mode: 'insensitive' } },
      {
        motorista: {
          is: {
            OR: expect.arrayContaining([
              { nome: { contains: 'Edinaldo', mode: 'insensitive' } },
            ]),
          },
        },
      },
      {
        fornecedor: {
          is: {
            OR: expect.arrayContaining([
              { nome: { contains: 'Edinaldo', mode: 'insensitive' } },
            ]),
          },
        },
      },
      {
        cliente: {
          is: {
            OR: expect.arrayContaining([
              { nome: { contains: 'Edinaldo', mode: 'insensitive' } },
            ]),
          },
        },
      },
    ]));
  });

  it('cria despesa manual com fornecedor, calcula total e zera cliente', async () => {
    const { service, create } = makeService();

    await service.create({ ...baseDto, fornecedorId: 'supplier-1', clienteId: 'client-1' });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      fornecedorId: 'supplier-1',
      clienteId: null,
      cavaloMecanicoId: 'horse-1',
      conjuntoId: 'set-1',
    }));
    expect(String(create.mock.calls[0][0].data.valorTotal)).toBe('20');
  });

  it('cria despesa usando cavalo mecânico sem exigir placa no payload', async () => {
    const { service, create } = makeService();

    await service.create({ ...baseDto, placa: undefined, cavaloMecanicoId: 'horse-1', fornecedorId: 'supplier-1' });

    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      placa: 'ABC1D23',
      cavaloMecanicoId: 'horse-1',
      conjuntoId: 'set-1',
    }));
  });

  it('usa somente o valor unitário quando a multiplicação é desmarcada', async () => {
    const { service, create } = makeService();
    await service.create({ ...baseDto, fornecedorId: 'supplier-1', multiplicarQuantidade: false });
    expect(String(create.mock.calls[0][0].data.valorTotal)).toBe('10');
    expect(create.mock.calls[0][0].data.multiplicarQuantidade).toBe(false);
  });

  it('permite despesa manual sem motorista, mas bloqueia sem fornecedor', async () => {
    const { service, create } = makeService();
    await service.create({ ...baseDto, motoristaId: undefined, fornecedorId: 'supplier-1' });
    expect(create.mock.calls[0][0].data.motoristaId).toBeUndefined();

    await expect(service.create({ ...baseDto, fornecedorId: null })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cria faturamento sem comissão para composição diferente de 4, 7 e 9 eixos', async () => {
    const { service, create } = makeService(6);

    await service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      clienteId: 'client-1',
      fornecedorId: 'supplier-1',
      tipoComissao: TipoComissao.PERCENTUAL,
      percentualComissao: 12,
      valorComissaoPorViagem: 240,
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      clienteId: 'client-1',
      fornecedorId: null,
      tipoComissao: null,
      valorComissao: null,
    }));
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

  it('calcula 12% para 7 eixos e cria a despesa automática vinculada sem fornecedor', async () => {
    const { service, create, prisma } = makeService(7);

    const result: any = await service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      clienteId: 'client-1',
      tipoComissao: TipoComissao.PERCENTUAL,
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      tipoComissao: TipoComissao.PERCENTUAL,
      quantidadeEixosComissao: 7,
    }));
    expect(String(create.mock.calls[0][0].data.percentualComissao)).toBe('12');
    expect(String(create.mock.calls[0][0].data.valorComissao)).toBe('2.4');
    expect(create.mock.calls[1][0].data).toEqual(expect.objectContaining({
      tipoLancamento: TipoLancamento.DESPESA,
      fornecedorId: null,
      clienteId: null,
      faturamentoOrigemId: 'launch-created',
      categoriaId: 'commission-category',
    }));
    expect(String(create.mock.calls[1][0].data.valorTotal)).toBe('2.4');
    expect(result.despesaComissao.id).toBe('commission-1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('desconta 12% de impostos da comissão e lança a despesa pelo valor líquido', async () => {
    const { service, create } = makeService(7);

    await service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      clienteId: 'client-1',
      quantidade: 1,
      valorUnitario: 10000,
      tipoComissao: TipoComissao.PERCENTUAL,
      descontoImpostos: true,
    });

    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      descontoImpostos: true,
      quantidadeEixosComissao: 7,
    }));
    expect(String(create.mock.calls[0][0].data.valorComissaoBruta)).toBe('1200');
    expect(String(create.mock.calls[0][0].data.valorDescontoImpostos)).toBe('144');
    expect(String(create.mock.calls[0][0].data.valorComissao)).toBe('1056');
    expect(String(create.mock.calls[1][0].data.valorTotal)).toBe('1056');
    expect(create.mock.calls[1][0].data.descricao).toContain('desconto de impostos');
  });

  it('aplica os padrões de 12% e R$ 240 por viagem para 4 eixos', async () => {
    const { service, create } = makeService(4);

    await service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      clienteId: 'client-1',
      tipoComissao: TipoComissao.POR_VIAGEM,
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      tipoComissao: TipoComissao.POR_VIAGEM,
      quantidadeEixosComissao: 4,
    }));
    expect(String(create.mock.calls[0][0].data.percentualComissao)).toBe('12');
    expect(String(create.mock.calls[0][0].data.valorComissaoPorViagem)).toBe('240');
    expect(String(create.mock.calls[0][0].data.valorComissao)).toBe('240');
    expect(String(create.mock.calls[1][0].data.valorTotal)).toBe('240');
  });

  it('calcula 12% para faturamento com composição de 4 eixos', async () => {
    const { service, create } = makeService(4);

    await service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      clienteId: 'client-1',
      tipoComissao: TipoComissao.PERCENTUAL,
    });

    expect(String(create.mock.calls[0][0].data.percentualComissao)).toBe('12');
    expect(String(create.mock.calls[0][0].data.valorComissao)).toBe('2.4');
    expect(String(create.mock.calls[1][0].data.valorTotal)).toBe('2.4');
  });

  it('calcula comissão fixa para 9 eixos e permite personalizar os dois valores', async () => {
    const { service, create } = makeService(9);

    await service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      clienteId: 'client-1',
      tipoComissao: TipoComissao.POR_VIAGEM,
      percentualComissao: 10.5,
      valorComissaoPorViagem: 400,
    });

    expect(String(create.mock.calls[0][0].data.percentualComissao)).toBe('10.5');
    expect(String(create.mock.calls[0][0].data.valorComissaoPorViagem)).toBe('400');
    expect(String(create.mock.calls[0][0].data.valorComissao)).toBe('400');
    expect(String(create.mock.calls[1][0].data.valorTotal)).toBe('400');
  });

  it('arredonda o faturamento em centavos antes de calcular o percentual', async () => {
    const { service, create } = makeService(9);

    await service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      clienteId: 'client-1',
      quantidade: 1.001,
      valorUnitario: 101.49,
      tipoComissao: TipoComissao.PERCENTUAL,
    });

    expect(String(create.mock.calls[0][0].data.valorTotal)).toBe('101.59');
    expect(String(create.mock.calls[0][0].data.valorComissao)).toBe('11.17');
    expect(String(create.mock.calls[1][0].data.valorTotal)).toBe('11.17');
  });

  it('exige tipo de comissão em novo faturamento elegível', async () => {
    const { service } = makeService(7);
    await expect(service.create({
      ...baseDto,
      tipoLancamento: TipoLancamento.FATURAMENTO,
      clienteId: 'client-1',
    })).rejects.toThrow('Selecione o tipo de comissão');
  });

  it('edita lançamento legado sem criar comissão implicitamente', async () => {
    const { service, update, create, findUnique } = makeService(7, {
      tipoLancamento: TipoLancamento.FATURAMENTO,
      fornecedorId: null,
      clienteId: 'client-1',
      conjuntoId: null,
      conjunto: null,
    });

    await service.update('launch-1', { descricao: 'Faturamento legado corrigido' });

    expect(update.mock.calls[0][0].data).toEqual(expect.objectContaining({ conjuntoId: null, tipoComissao: null, valorComissao: null }));
    expect(create).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('usa a composição ativa e cria a despesa quando a comissão é escolhida em faturamento legado sem conjunto', async () => {
    const { service, update, create, findUnique } = makeService(7, {
      tipoLancamento: TipoLancamento.FATURAMENTO,
      fornecedorId: null,
      clienteId: 'client-1',
      conjuntoId: null,
      conjunto: null,
    });

    await service.update('launch-1', {
      cavaloMecanicoId: 'horse-1',
      tipoComissao: TipoComissao.PERCENTUAL,
    });

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'horse-1' } }));
    expect(update.mock.calls[0][0].data).toEqual(expect.objectContaining({
      conjuntoId: 'set-1',
      quantidadeEixosComissao: 7,
      tipoComissao: TipoComissao.PERCENTUAL,
    }));
    expect(String(update.mock.calls[0][0].data.valorComissao)).toBe('2.4');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      tipoLancamento: TipoLancamento.DESPESA,
      faturamentoOrigemId: 'launch-1',
    }));
  });

  it('recalcula faturamento e sincroniza a despesa automática ao editar', async () => {
    const despesa = { id: 'commission-1', valorTotal: 2.4, faturamentoOrigemId: 'launch-1' };
    const { service, update } = makeService(7, {
      tipoLancamento: TipoLancamento.FATURAMENTO,
      fornecedorId: null,
      clienteId: 'client-1',
      tipoComissao: TipoComissao.PERCENTUAL,
      percentualComissao: 12,
      valorComissaoPorViagem: 240,
      valorComissao: 2.4,
      quantidadeEixosComissao: 7,
      despesaComissao: despesa,
    });

    await service.update('launch-1', { valorUnitario: 20 });

    expect(update).toHaveBeenCalledTimes(2);
    expect(String(update.mock.calls[0][0].data.valorComissao)).toBe('4.8');
    expect(update.mock.calls[1][0].where).toEqual({ id: 'commission-1' });
    expect(String(update.mock.calls[1][0].data.valorTotal)).toBe('4.8');
  });

  it('mantém o desconto de impostos e sincroniza a despesa líquida ao editar', async () => {
    const despesa = { id: 'commission-1', valorTotal: 2.11, faturamentoOrigemId: 'launch-1' };
    const { service, update } = makeService(7, {
      tipoLancamento: TipoLancamento.FATURAMENTO,
      fornecedorId: null,
      clienteId: 'client-1',
      tipoComissao: TipoComissao.PERCENTUAL,
      percentualComissao: 12,
      valorComissaoPorViagem: 240,
      descontoImpostos: true,
      valorComissaoBruta: 2.4,
      valorDescontoImpostos: 0.29,
      valorComissao: 2.11,
      quantidadeEixosComissao: 7,
      despesaComissao: despesa,
    });

    await service.update('launch-1', { valorUnitario: 20 });

    expect(String(update.mock.calls[0][0].data.valorComissaoBruta)).toBe('4.8');
    expect(String(update.mock.calls[0][0].data.valorDescontoImpostos)).toBe('0.58');
    expect(String(update.mock.calls[0][0].data.valorComissao)).toBe('4.22');
    expect(String(update.mock.calls[1][0].data.valorTotal)).toBe('4.22');
  });

  it('restaura os padrões de 9 eixos quando a composição de um faturamento com comissão muda', async () => {
    const despesa = { id: 'commission-1', valorTotal: 2.4, faturamentoOrigemId: 'launch-1' };
    const { service, update } = makeService(9, {
      tipoLancamento: TipoLancamento.FATURAMENTO,
      fornecedorId: null,
      clienteId: 'client-1',
      tipoComissao: TipoComissao.PERCENTUAL,
      percentualComissao: 12,
      valorComissaoPorViagem: 240,
      valorComissao: 2.4,
      quantidadeEixosComissao: 7,
      despesaComissao: despesa,
    });

    await service.update('launch-1', { cavaloMecanicoId: 'horse-2' });

    expect(update.mock.calls[0][0].data).toEqual(expect.objectContaining({
      cavaloMecanicoId: 'horse-2',
      conjuntoId: 'set-2',
      quantidadeEixosComissao: 9,
    }));
    expect(String(update.mock.calls[0][0].data.percentualComissao)).toBe('11');
    expect(String(update.mock.calls[0][0].data.valorComissaoPorViagem)).toBe('330');
    expect(String(update.mock.calls[0][0].data.valorComissao)).toBe('2.2');
  });

  it('remove a despesa automática quando o faturamento muda para composição sem comissão', async () => {
    const despesa = { id: 'commission-1', valorTotal: 2.4, faturamentoOrigemId: 'launch-1' };
    const { service, update, remove } = makeService(6, {
      tipoLancamento: TipoLancamento.FATURAMENTO,
      fornecedorId: null,
      clienteId: 'client-1',
      tipoComissao: TipoComissao.PERCENTUAL,
      percentualComissao: 12,
      valorComissaoPorViagem: 240,
      valorComissao: 2.4,
      quantidadeEixosComissao: 7,
      despesaComissao: despesa,
    });

    await service.update('launch-1', { cavaloMecanicoId: 'horse-2' });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data).toEqual(expect.objectContaining({
      tipoComissao: null,
      percentualComissao: null,
      valorComissao: null,
      quantidadeEixosComissao: null,
    }));
    expect(remove).toHaveBeenCalledWith({ where: { id: 'commission-1' } });
  });

  it('bloqueia alteração e exclusão direta da despesa automática', async () => {
    const { service } = makeService(7, { faturamentoOrigemId: 'billing-1' });

    await expect(service.update('commission-1', { descricao: 'Tentativa manual' })).rejects.toThrow('despesa de comissão é automática');
    await expect(service.remove('commission-1')).rejects.toThrow('despesa de comissão é automática');
  });
});
