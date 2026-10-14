import { BadRequestException } from '@nestjs/common';
import { StatusGeral, TipoComissao, TipoConjuntoOperacional, TipoLancamento, UnidadeQuantidade } from '@prisma/client';
import { ContextoFrotaHistorica } from '../caminhoes/composicao-historica';
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
    lancamentoFinanceiro: {
      create,
      update,
      delete: remove,
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    cavaloMecanico: { findUnique },
    conjunto: { findUnique: jest.fn() },
    categoriaFinanceira: {
      upsert: jest.fn(async () => ({ id: 'commission-category', codigoSistema: 'COMISSAO_MOTORISTA' })),
    },
    auditoria: { create: jest.fn() },
    lancamentoImportado: { findUnique: jest.fn(async () => null) },
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
    importacao: null,
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
  prisma.lancamentoFinanceiro.findUnique.mockResolvedValue(current);
  prisma.categoriaFinanceira.findUnique = jest.fn(async () => ({ ativo: true, tipoLancamento: null }));
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

function historicalContext(): ContextoFrotaHistorica {
  return {
    cavalos: new Map([['horse-1', { id: 'horse-1', placa: 'ABC1D23' }]]),
    conjuntos: [
      {
        id: 'historical-7', nome: 'Composição anterior', cavaloMecanicoId: 'horse-1',
        tipo: TipoConjuntoOperacional.BITREM, quantidadeTotalEixos: 7, status: StatusGeral.INATIVO,
        createdAt: new Date('2026-09-01T00:00:00.000Z'), justificativaSemImplemento: null, historicos: [],
        implementos: ['trailer-1', 'trailer-2'].map((implementoId, ordem) => ({
          implementoId, ordem: ordem + 1,
          dataInicio: new Date('2026-09-01T00:00:00.000Z'), dataFim: new Date('2026-10-08T00:00:00.000Z'),
        })),
      },
      {
        id: 'current-9', nome: 'Composição atual', cavaloMecanicoId: 'horse-1',
        tipo: TipoConjuntoOperacional.RODOTREM, quantidadeTotalEixos: 9, status: StatusGeral.ATIVO,
        createdAt: new Date('2026-10-08T00:00:00.000Z'), justificativaSemImplemento: null, historicos: [],
        implementos: ['trailer-3', 'trailer-4'].map((implementoId, ordem) => ({
          implementoId, ordem: ordem + 1, dataInicio: new Date('2026-10-08T00:00:00.000Z'), dataFim: null,
        })),
      },
    ],
  };
}

const historicalBillingDto = {
  ...baseDto,
  data: new Date('2026-10-01T00:00:00.000Z'),
  cavaloMecanicoId: 'horse-1',
  tipoLancamento: TipoLancamento.FATURAMENTO,
  clienteId: 'client-1',
  quantidade: 32500,
  valorUnitario: 4850,
  multiplicarQuantidade: false,
  tipoComissao: TipoComissao.PERCENTUAL,
};

describe('LancamentosFinanceirosService', () => {
  it('ordena controles numericamente e pesquisa com F e zeros à esquerda', () => {
    const { service } = makeService();
    expect((service as any).buildOrderBy({ orderBy: 'numeroControle', orderDirection: 'asc' })[0]).toEqual({ numeroControle: 'asc' });
    expect((service as any).buildWhere({ numeroControle: 'F01' }).numeroControle).toBe(1);
    expect((service as any).buildWhere({ numeroControle: 'F100' }).numeroControle).toBe(100);
    expect((service as any).buildWhere({ search: 'F01' }).OR).toContainEqual({ numeroControle: 1 });
    expect((service as any).buildWhere({ numeroControle: 'F999999999999999999' }).numeroControle).toBe(-1);
  });
  it.each([
    { data: '2026-10-01', eixos: 7, percentual: '12', comissao: '582' },
    { data: '2026-10-09', eixos: 9, percentual: '11', comissao: '533.5' },
  ])('valida comissão pelos $eixos eixos vigentes em $data sem consultar a frota atual', async ({ data, eixos, percentual, comissao }) => {
    const { service, prisma, create, findUnique } = makeService(9);
    const result = await service.validateInTransaction(prisma, {
      ...historicalBillingDto, data: new Date(data + 'T00:00:00.000Z'),
    }, historicalContext());

    expect(result.quantidadeTotalEixos).toBe(eixos);
    expect(String(result.valorTotal)).toBe('4850');
    expect(String(result.comissao.percentualComissao)).toBe(percentual);
    expect(String(result.comissao.valorComissao)).toBe(comissao);
    expect(findUnique).not.toHaveBeenCalled();
    expect(prisma.conjunto.findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(prisma.categoriaFinanceira.upsert).not.toHaveBeenCalled();
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('persiste composição histórica, snapshot de eixos e despesa líquida na transação recebida', async () => {
    const { service, prisma, create, findUnique } = makeService(9);
    const result = await service.createInTransaction(prisma, {
      ...historicalBillingDto, conjuntoId: 'historical-7', descontoImpostos: true,
    }, { id: 'admin-importacao' }, true, historicalContext());

    expect(result).toMatchObject({ conjuntoId: 'historical-7', quantidadeEixosComissao: 7, cavaloMecanicoId: 'horse-1' });
    expect(String(result.valorComissaoBruta)).toBe('582');
    expect(String(result.valorDescontoImpostos)).toBe('69.84');
    expect(String(result.valorComissao)).toBe('512.16');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].data).toMatchObject({ conjuntoId: 'historical-7', faturamentoOrigemId: result.id });
    expect(String(create.mock.calls[1][0].data.valorTotal)).toBe('512.16');
    expect(findUnique).not.toHaveBeenCalled();
    expect(prisma.conjunto.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditoria.create).toHaveBeenCalledTimes(2);
  });

  it('rejeita conjunto explícito divergente da data antes de validar ou gravar a comissão', async () => {
    const { service, prisma, create, findUnique } = makeService(9);
    const dto = { ...historicalBillingDto, conjuntoId: 'current-9' };
    const contexto = historicalContext();

    await expect(service.validateInTransaction(prisma, dto, contexto)).rejects.toThrow('não corresponde ao histórico');
    await expect(service.createInTransaction(prisma, dto, undefined, false, contexto)).rejects.toThrow('não corresponde ao histórico');

    expect(findUnique).not.toHaveBeenCalled();
    expect(prisma.conjunto.findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(prisma.categoriaFinanceira.upsert).not.toHaveBeenCalled();
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
  });

  it.each(['sem histórico', 'ambígua'])('recusa composição %s sem recorrer à composição atual', async (cenario) => {
    const { service, prisma, create, findUnique } = makeService(9);
    const contexto = historicalContext();
    contexto.conjuntos = cenario === 'sem histórico' ? [] : [
      ...contexto.conjuntos,
      { ...contexto.conjuntos[0], id: 'overlapping-7' },
    ];

    await expect(service.validateInTransaction(prisma, historicalBillingDto, contexto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createInTransaction(prisma, historicalBillingDto, undefined, false, contexto)).rejects.toBeInstanceOf(BadRequestException);

    expect(findUnique).not.toHaveBeenCalled();
    expect(prisma.conjunto.findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(prisma.categoriaFinanceira.upsert).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recusa cavalo ausente do contexto histórico sem buscar uma composição atual', async () => {
    const { service, prisma, findUnique, create } = makeService(9);

    await expect(service.validateInTransaction(prisma, {
      ...historicalBillingDto, cavaloMecanicoId: 'horse-2',
    }, historicalContext())).rejects.toThrow('não encontrado no contexto da importação');

    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('mantém a escolha obrigatória de comissão para a composição histórica elegível', async () => {
    const { service, prisma, create } = makeService(6);

    await expect(service.validateInTransaction(prisma, {
      ...historicalBillingDto, tipoComissao: null,
    }, historicalContext())).rejects.toThrow('Selecione o tipo de comissão');

    expect(create).not.toHaveBeenCalled();
    expect(prisma.categoriaFinanceira.upsert).not.toHaveBeenCalled();
  });

  it('preserva a resolução atual no cadastro manual sem contexto histórico', async () => {
    const { service, prisma, findUnique } = makeService(9);

    const result = await service.validateInTransaction(prisma, historicalBillingDto);

    expect(result.quantidadeTotalEixos).toBe(9);
    expect(String(result.comissao.percentualComissao)).toBe('11');
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'horse-1' } }));
  });

  it('valida uma linha sem transação aninhada, gravações financeiras ou auditoria', async () => {
    const { service, prisma, create } = makeService(6);
    const result = await service.validateInTransaction(prisma, {
      ...baseDto, tipoLancamento: TipoLancamento.FATURAMENTO, clienteId: 'client-1',
      quantidade: 32_500, valorUnitario: 4_850, multiplicarQuantidade: false,
    });

    expect(result.quantidadeTotalEixos).toBe(6);
    expect(String(result.valorTotal)).toBe('4850');
    expect(result.comissao.tipoComissao).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(prisma.categoriaFinanceira.upsert).not.toHaveBeenCalled();
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([4, 7, 9])('exige escolha explícita de comissão no preview de %s eixos', async (eixos) => {
    const { service, prisma, create } = makeService(eixos);
    await expect(service.validateInTransaction(prisma, {
      ...baseDto, tipoLancamento: TipoLancamento.FATURAMENTO, clienteId: 'client-1',
    })).rejects.toThrow('Selecione o tipo de comissão');
    expect(create).not.toHaveBeenCalled();
    expect(prisma.categoriaFinanceira.upsert).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reutiliza as regras de cliente e fornecedor durante a validação transacional', async () => {
    const { service, prisma } = makeService();
    await expect(service.validateInTransaction(prisma, { ...baseDto, tipoLancamento: TipoLancamento.FATURAMENTO })).rejects.toThrow('Faturamento deve ter cliente');
    await expect(service.validateInTransaction(prisma, baseDto)).rejects.toThrow('Despesa deve ter fornecedor');
  });

  it('cria dentro da transação recebida com auditoria obrigatória e sem multiplicar o peso', async () => {
    const { service, prisma, create } = makeService(7);
    const result = await service.createInTransaction(prisma, {
      ...baseDto, tipoLancamento: TipoLancamento.FATURAMENTO, clienteId: 'client-1',
      quantidade: 32_500, valorUnitario: 4_850, multiplicarQuantidade: false,
      tipoComissao: TipoComissao.PERCENTUAL, descontoImpostos: true,
    }, { sub: 'admin-importacao' }, true);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(2);
    expect(String(result.valorTotal)).toBe('4850');
    expect(String(result.valorComissaoBruta)).toBe('582');
    expect(String(result.valorDescontoImpostos)).toBe('69.84');
    expect(String(result.valorComissao)).toBe('512.16');
    expect(result.despesaComissao).not.toBeNull();
    expect(String(result.despesaComissao!.valorTotal)).toBe('512.16');
    expect(prisma.auditoria.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditoria.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ entidade: 'lancamentoFinanceiro', entidadeId: result.id, acao: 'CRIACAO', usuarioId: 'admin-importacao' }),
    });
    expect(prisma.auditoria.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ entidade: 'lancamentoFinanceiro', entidadeId: result.despesaComissao!.id, acao: 'CRIACAO_COMISSAO', usuarioId: 'admin-importacao' }),
    });
  });

  it('propaga falha de auditoria para permitir rollback do lote importado', async () => {
    const { service, prisma } = makeService();
    prisma.auditoria.create.mockRejectedValueOnce(new Error('Falha de auditoria'));
    await expect(service.createInTransaction(prisma, {
      ...baseDto, tipoLancamento: TipoLancamento.FATURAMENTO, clienteId: 'client-1',
    }, { id: 'admin-importacao' }, true)).rejects.toThrow('Falha de auditoria');
  });

  it('permite criação transacional sem auditoria quando o chamador vai registrá-la depois', async () => {
    const { service, prisma } = makeService();
    await service.createInTransaction(prisma, { ...baseDto, fornecedorId: 'supplier-1' });
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bloqueia exclusão de lançamento importado preservando a chave de idempotência', async () => {
    const despesaComissao = { id: 'commission-1', valorTotal: 512.16, faturamentoOrigemId: 'launch-1' };
    const { service, prisma, create, update, remove, current } = makeService(7, {
      importacao: { id: 'import-1' }, despesaComissao,
    });
    const before = structuredClone(current);
    await expect(service.remove('launch-1')).rejects.toThrow('preservar a rastreabilidade');
    expect(current).toEqual(before);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    { valorUnitario: 6000 },
    { quantidade: 100 },
    { data: new Date('2026-10-02T00:00:00.000Z') },
    { cavaloMecanicoId: 'horse-2' },
    { tipoComissao: TipoComissao.POR_VIAGEM, valorComissaoPorViagem: 1 },
    { descricao: 'Tentativa de alteração manual' },
    { categoriaId: 'category-1' },
  ])('permite edição do importado auditada do faturamento e recalcula a comissão: %o', async (dto) => {
    const despesaComissao = { id: 'commission-1', valorTotal: 512.16, faturamentoOrigemId: 'launch-1' };
    const { service, prisma, update, current } = makeService(7, {
      tipoLancamento: TipoLancamento.FATURAMENTO,
      fornecedorId: null,
      clienteId: 'client-1',
      valorUnitario: 4850,
      quantidade: 32500,
      multiplicarQuantidade: false,
      tipoComissao: TipoComissao.PERCENTUAL,
      percentualComissao: 12,
      descontoImpostos: true,
      valorComissaoBruta: 582,
      valorDescontoImpostos: 69.84,
      valorComissao: 512.16,
      quantidadeEixosComissao: 7,
      despesaComissao,
      importacao: { id: 'import-1' },
    });
    const before = structuredClone(current);

    await service.update('launch-1', dto, { id: 'admin' });
    expect(current).toEqual(before);
    expect(update).toHaveBeenCalled();
    expect(prisma.auditoria.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: 'ATUALIZACAO', usuarioId: 'admin', dadosAntes: expect.objectContaining({ importacao: { id: 'import-1' } }),
    }) });
    expect(prisma.lancamentoImportado.findUnique).not.toHaveBeenCalled();

  });

  it('mantém consulta e listagem dos importados e expõe somente o identificador da importação', async () => {
    const { service, prisma, current, create, update, remove } = makeService(7, {
      importacao: { id: 'import-1' },
      despesaComissao: { id: 'commission-1', valorTotal: 512.16 },
    });
    jest.mocked(service.findOne).mockRestore();
    prisma.lancamentoFinanceiro.findUnique.mockResolvedValue(current);
    prisma.lancamentoFinanceiro.findMany.mockResolvedValue([current]);
    prisma.lancamentoFinanceiro.count.mockResolvedValue(1);

    await expect(service.findOne('launch-1')).resolves.toEqual(current);
    await expect(service.findAll({ page: 1, limit: 10 })).resolves.toMatchObject({ data: [current], total: 1 });

    const include = expect.objectContaining({ importacao: { select: { id: true } }, despesaComissao: true });
    expect(prisma.lancamentoFinanceiro.findUnique).toHaveBeenCalledWith({ where: { id: 'launch-1' }, include });
    expect(prisma.lancamentoFinanceiro.findMany).toHaveBeenCalledWith(expect.objectContaining({ include }));
    expect(prisma.lancamentoImportado.findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([TipoLancamento.DESPESA, TipoLancamento.FATURAMENTO])('continua editando %s manual sem vínculo de importação', async (tipoLancamento) => {
    const { service, update, prisma } = makeService(6, {
      tipoLancamento,
      fornecedorId: tipoLancamento === TipoLancamento.DESPESA ? 'supplier-1' : null,
      clienteId: tipoLancamento === TipoLancamento.FATURAMENTO ? 'client-1' : null,
      importacao: null,
    });

    await service.update('launch-1', { descricao: 'Correção manual', valorUnitario: 20 });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data).toMatchObject({ descricao: 'Correção manual', tipoComissao: null });
    expect(String(update.mock.calls[0][0].data.valorTotal)).toBe('40');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it.each([TipoLancamento.DESPESA, TipoLancamento.FATURAMENTO])(
    'ordena %s por ordem de lançamento decrescente quando nenhuma outra ordenação é escolhida',
    async (tipoLancamento) => {
      const { service, prisma } = makeService();

      await service.findAll({
        page: 1,
        limit: 10,
        tipoLancamento,
      });

      expect(prisma.lancamentoFinanceiro.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { tipoLancamento },
        orderBy: [{ createdAt: 'desc' }],
      }));
    },
  );

  it('ordena a listagem pelo valor exibido da coluna e mantém a paginação estável', async () => {
    const { service, prisma } = makeService();

    await service.findAll({
      page: 2,
      limit: 10,
      orderBy: 'motoristaId',
      orderDirection: 'desc',
    });

    expect(prisma.lancamentoFinanceiro.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      orderBy: [
        { motorista: { nome: 'desc' } },
        { createdAt: 'desc' },
      ],
    }));
  });

  it('ignora campos de ordenação não permitidos', () => {
    const { service } = makeService();

    expect((service as any).buildOrderBy({
      orderBy: 'campoInexistente',
      orderDirection: 'asc',
    })).toEqual([{ createdAt: 'desc' }]);
  });

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

  it('combina os filtros específicos de todas as colunas financeiras', () => {
    const { service } = makeService();

    const where = (service as any).buildWhere({
      tipoLancamento: TipoLancamento.DESPESA,
      data: '2026-08-06',
      cavalo: 'volvo',
      motorista: 'edinaldo',
      fornecedor: 'posto',
      categoria: 'diesel',
      quantidade: 2.5,
      valorUnitario: 10,
      valorTotal: 25,
    });

    expect(where).toEqual(expect.objectContaining({
      tipoLancamento: TipoLancamento.DESPESA,
      data: {
        gte: new Date('2026-08-06T00:00:00.000Z'),
        lt: new Date('2026-08-07T00:00:00.000Z'),
      },
      cavaloMecanico: {
        is: { OR: expect.arrayContaining([{ placa: { contains: 'volvo', mode: 'insensitive' } }]) },
      },
      motorista: {
        is: { OR: expect.arrayContaining([{ nome: { contains: 'edinaldo', mode: 'insensitive' } }]) },
      },
      fornecedor: {
        is: { OR: expect.arrayContaining([{ nome: { contains: 'posto', mode: 'insensitive' } }]) },
      },
      categoriaFinanceira: {
        is: { OR: [{ nome: { contains: 'diesel', mode: 'insensitive' } }] },
      },
      quantidade: 2.5,
      valorUnitario: 10,
      valorTotal: 25,
    }));
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
