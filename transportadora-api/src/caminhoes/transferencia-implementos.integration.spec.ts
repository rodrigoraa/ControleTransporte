import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, relative, sep } from 'node:path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CavaloMecanico, Implemento, PrismaClient, StatusGeral, TipoCavaloMecanico, TipoCarroceria, TipoImplemento } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CaminhoesService } from './caminhoes.service';
import { ComposicoesCavaloService } from './composicoes-cavalo.service';

jest.setTimeout(60_000);

const clusterPrefix = 'controle-transporte-transferencias-';
const postgresUser = 'transfer_test';
const executable = (name: string) => `${name}${process.platform === 'win32' ? '.exe' : ''}`;
const postgresBin = [
  process.env.POSTGRES_TEST_BIN,
  ...(process.platform === 'win32'
    ? [join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL', '18', 'bin')]
    : [18, 17, 16, 15].map((version) => `/usr/lib/postgresql/${version}/bin`)),
].filter((candidate): candidate is string => Boolean(candidate))
  .find((candidate) => ['initdb', 'pg_ctl', 'postgres'].every((name) => existsSync(join(candidate, executable(name)))));
const describePostgres = postgresBin ? describe : describe.skip;

async function availablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Não foi possível reservar uma porta para o PostgreSQL temporário.'));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function runPostgres(name: string, args: string[]) {
  execFileSync(join(postgresBin!, executable(name)), args, {
    windowsHide: true, timeout: 30_000, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe',
  });
}

function removeTemporaryCluster(directory: string) {
  const target = realpathSync(directory);
  const child = relative(realpathSync(tmpdir()), target);
  if (!child.startsWith(clusterPrefix) || child.includes(sep) || basename(target) !== child) {
    throw new Error('O diretório não é um cluster temporário autorizado para remoção.');
  }
  rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

const selection = (implemento: Implemento) => ({
  id: implemento.id,
  placa: implemento.placa,
  tipo: implemento.tipo,
  carroceria: implemento.carroceria,
  quantidadeEixos: implemento.quantidadeEixos,
  capacidadeCarga: Number(implemento.capacidadeCarga),
});

describePostgres('Transferência de implementos - PostgreSQL temporário (POSTGRES_TEST_BIN ou instalação local)', () => {
  let clusterDirectory: string | undefined;
  let dataDirectory: string | undefined;
  let prisma: PrismaClient;
  let composicoes: ComposicoesCavaloService;
  let service: CaminhoesService;
  let sequence = 0;

  beforeAll(async () => {
    clusterDirectory = mkdtempSync(join(realpathSync(tmpdir()), clusterPrefix));
    dataDirectory = join(clusterDirectory, 'data');
    const port = await availablePort();
    runPostgres('initdb', ['-D', dataDirectory, '--username', postgresUser, '--auth=trust', '--encoding=UTF8', '--no-locale', '--no-sync']);
    runPostgres('pg_ctl', [
      '-D', dataDirectory, '-l', join(clusterDirectory, 'postgres.log'), '-o',
      `-h 127.0.0.1 -p ${port} -F -c unix_socket_directories= -c timezone=UTC`, '-w', '-t', '20', 'start',
    ]);
    const url = `postgresql://${postgresUser}@127.0.0.1:${port}/postgres?schema=public&connection_limit=8&connect_timeout=5&pool_timeout=5`;
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    const identity = await prisma.$queryRaw<Array<{ directory: string; port: number; usuario: string }>>`
      SELECT current_setting('data_directory') AS directory, inet_server_port() AS port, current_user AS usuario
    `;
    expect(identity[0].port).toBe(port);
    expect(identity[0].usuario).toBe(postgresUser);
    expect(realpathSync(identity[0].directory)).toBe(realpathSync(dataDirectory));

    // Ambas as URLs são substituídas somente após confirmar a identidade do cluster isolado.
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', join(__dirname, '../../prisma/schema.prisma')], {
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      windowsHide: true, timeout: 30_000, stdio: 'pipe',
    });
  });

  beforeEach(async () => {
    await prisma.historicoImplemento.deleteMany();
    await prisma.historicoCavaloMecanico.deleteMany();
    await prisma.historicoConjuntoOperacional.deleteMany();
    await prisma.historicoMotorista.deleteMany();
    await prisma.lancamentoFinanceiro.deleteMany();
    await prisma.conjuntoImplemento.deleteMany();
    await prisma.conjunto.deleteMany();
    await prisma.implemento.deleteMany();
    await prisma.cavaloMecanico.deleteMany();
    await prisma.motorista.deleteMany();
    await prisma.auditoria.deleteMany();
    composicoes = new ComposicoesCavaloService();
    service = new CaminhoesService(prisma as PrismaService, composicoes);
  });

  afterEach(() => { jest.restoreAllMocks(); });

  afterAll(async () => {
    try {
      await prisma?.$disconnect();
    } finally {
      if (dataDirectory && existsSync(join(dataDirectory, 'postmaster.pid'))) {
        runPostgres('pg_ctl', ['-D', dataDirectory, '-m', 'fast', '-w', '-t', '20', 'stop']);
      }
      if (clusterDirectory) removeTemporaryCluster(clusterDirectory);
    }
  });

  async function cavalo(tipoCavalo: TipoCavaloMecanico = TipoCavaloMecanico.TRUCADO_6X2) {
    return prisma.cavaloMecanico.create({ data: { placa: `CAV${String(++sequence).padStart(4, '0')}`, marca: 'Teste', tipoCavalo } });
  }

  async function implemento(tipo: TipoImplemento = TipoImplemento.CARRETA, quantidadeEixos = 3) {
    return prisma.implemento.create({
      data: {
        placa: `IMP${String(++sequence).padStart(4, '0')}`, tipo, carroceria: TipoCarroceria.GRANELEIRO,
        quantidadeEixos: tipo === TipoImplemento.DOLLY ? 2 : quantidadeEixos,
        capacidadeCarga: tipo === TipoImplemento.DOLLY ? 0 : 30_123.456,
      },
    });
  }

  async function conjunto(owner: CavaloMecanico, implementos: Implemento[], status: StatusGeral = StatusGeral.ATIVO) {
    return prisma.$transaction((tx) => composicoes.createConjunto(
      tx, owner, implementos, status, 'Observação histórica preservada', new Date(Date.UTC(2026, 0, 1, 0, 0, ++sequence)),
    ));
  }

  async function ativos(cavaloMecanicoId?: string) {
    return prisma.conjunto.findMany({
      where: { status: StatusGeral.ATIVO, ...(cavaloMecanicoId ? { cavaloMecanicoId } : {}) },
      include: { implementos: { where: { dataFim: null }, orderBy: { ordem: 'asc' }, include: { implemento: true } } },
    });
  }

  async function assertNoDuplicateActiveLinks() {
    const duplicates = await prisma.$queryRaw<Array<{ implementoId: string }>>`
      SELECT ci."implementoId" FROM "conjuntos_implementos" ci
      JOIN "conjuntos" c ON c."id" = ci."conjuntoId"
      WHERE ci."dataFim" IS NULL AND c."status" = 'ATIVO'
      GROUP BY ci."implementoId" HAVING COUNT(*) > 1
    `;
    expect(duplicates).toEqual([]);
  }

  async function snapshot() {
    const orderBy = { id: 'asc' as const };
    return Promise.all([
      prisma.cavaloMecanico.findMany({ orderBy }), prisma.implemento.findMany({ orderBy }),
      prisma.conjunto.findMany({ orderBy }), prisma.conjuntoImplemento.findMany({ orderBy }),
      prisma.historicoCavaloMecanico.findMany({ orderBy }), prisma.historicoImplemento.findMany({ orderBy }),
      prisma.historicoConjuntoOperacional.findMany({ orderBy }), prisma.lancamentoFinanceiro.findMany({ orderBy }),
      prisma.historicoMotorista.findMany({ orderBy }), prisma.motorista.findMany({ orderBy }),
    ]);
  }

  it.each([TipoImplemento.CARRETA, TipoImplemento.SEMIRREBOQUE, TipoImplemento.REBOQUE])('transfere %s, encerra a origem e registra antes/depois sem excluir histórico', async (tipo) => {
    const [origem, destino, item] = await Promise.all([cavalo(), cavalo(), implemento(tipo)]);
    const antigo = await conjunto(origem, [item]);
    const historicosAntes = await prisma.historicoConjuntoOperacional.findMany({ where: { conjuntoId: antigo.id } });

    await service.update(destino.id, { implementos: [selection(item)] });

    expect(await ativos(origem.id)).toEqual([]);
    const [novo] = await ativos(destino.id);
    expect(novo).toMatchObject({ tipo: 'SIMPLES', quantidadeTotalEixos: 6 });
    expect(Number(novo.capacidadeTotal)).toBe(30_123.456);
    expect(novo.implementos.map((link) => link.implementoId)).toEqual([item.id]);
    const oldLink = await prisma.conjuntoImplemento.findFirstOrThrow({ where: { conjuntoId: antigo.id, implementoId: item.id } });
    expect(oldLink.dataFim).toEqual(novo.implementos[0].dataInicio);
    expect(await prisma.conjunto.findUniqueOrThrow({ where: { id: antigo.id } })).toMatchObject({
      status: 'INATIVO', nome: antigo.nome, tipo: antigo.tipo, quantidadeTotalEixos: antigo.quantidadeTotalEixos,
      capacidadeTotal: antigo.capacidadeTotal, observacoes: antigo.observacoes,
    });
    for (const historico of historicosAntes) {
      expect(await prisma.historicoConjuntoOperacional.findUnique({ where: { id: historico.id } })).toEqual(historico);
    }
    const transfers = await prisma.historicoImplemento.findMany({ where: { implementoId: item.id, acao: 'TRANSFERENCIA_IMPLEMENTO' } });
    expect(transfers).toHaveLength(1);
    const time = oldLink.dataFim!.toISOString();
    expect(transfers[0].dadosAntes).toMatchObject({ implementoId: item.id, placa: item.placa, cavaloMecanicoId: origem.id, cavaloPlaca: origem.placa, conjuntoId: antigo.id, dataHora: time });
    expect(transfers[0].dadosDepois).toMatchObject({ implementoId: item.id, placa: item.placa, cavaloMecanicoId: destino.id, cavaloPlaca: destino.placa, conjuntoId: novo.id, dataHora: time });
    expect(transfers[0].createdAt).toEqual(oldLink.dataFim);
    expect(await prisma.historicoCavaloMecanico.count({ where: { cavaloMecanicoId: origem.id, acao: 'DESENGATE_IMPLEMENTO' } })).toBe(1);
    expect(await prisma.historicoConjuntoOperacional.count({ where: { conjuntoId: antigo.id, acao: 'ENCERRAMENTO_COMPOSICAO' } })).toBe(1);
    expect(await prisma.historicoConjuntoOperacional.count({ where: { conjuntoId: novo.id, acao: 'CRIACAO_COMPOSICAO' } })).toBe(1);
    await assertNoDuplicateActiveLinks();
  });

  it('transfere duas carretas juntas, substitui o destino e usa um único instante para todos os vínculos', async () => {
    const [origem, destino, first, second, atualDestino] = await Promise.all([cavalo(), cavalo(), implemento(), implemento(), implemento()]);
    const antigo = await conjunto(origem, [first, second]);
    const antigoDestino = await conjunto(destino, [atualDestino]);

    await service.update(destino.id, { implementos: [selection(first), selection(second)] });

    expect(await ativos(origem.id)).toEqual([]);
    const novos = await ativos(destino.id);
    expect(novos).toHaveLength(1);
    expect(novos[0]).toMatchObject({ tipo: 'BITREM', quantidadeTotalEixos: 9 });
    expect(Number(novos[0].capacidadeTotal)).toBe(60_246.912);
    const links = await prisma.conjuntoImplemento.findMany({ where: { conjuntoId: { in: [antigo.id, antigoDestino.id] } } });
    expect(links).toHaveLength(3);
    expect(links.every((link) => link.dataFim?.getTime() === novos[0].implementos[0].dataInicio.getTime())).toBe(true);
    expect(novos[0].implementos[1].dataInicio).toEqual(novos[0].implementos[0].dataInicio);
    expect(await prisma.historicoImplemento.count({ where: { acao: 'TRANSFERENCIA_IMPLEMENTO' } })).toBe(2);
    await assertNoDuplicateActiveLinks();
  });

  it('transfere um dolly e recria a origem como bitrem válido', async () => {
    const [origem, destino, first, dolly, second, newFirst, newSecond] = await Promise.all([
      cavalo(), cavalo(), implemento(), implemento(TipoImplemento.DOLLY), implemento(), implemento(), implemento(),
    ]);
    const antigo = await conjunto(origem, [first, dolly, second]);

    await service.update(destino.id, { implementos: [selection(newFirst), selection(dolly), selection(newSecond)] });

    const [restante] = await ativos(origem.id);
    expect(restante.id).not.toBe(antigo.id);
    expect(restante).toMatchObject({ tipo: 'BITREM', quantidadeTotalEixos: 9 });
    expect(restante.implementos.map((link) => link.implementoId)).toEqual([first.id, second.id]);
    const [novo] = await ativos(destino.id);
    expect(novo).toMatchObject({ tipo: 'RODOTREM', quantidadeTotalEixos: 11 });
    expect(novo.implementos.map((link) => link.implementoId)).toEqual([newFirst.id, dolly.id, newSecond.id]);
    const links = await prisma.conjuntoImplemento.findMany({ where: { conjuntoId: antigo.id } });
    expect(links.every((link) => link.dataFim?.getTime() === novo.implementos[0].dataInicio.getTime())).toBe(true);
    expect(restante.implementos.every((link) => link.dataInicio.getTime() === novo.implementos[0].dataInicio.getTime())).toBe(true);
    expect(await prisma.historicoImplemento.count({ where: { implementoId: dolly.id, acao: 'TRANSFERENCIA_IMPLEMENTO' } })).toBe(1);
    await assertNoDuplicateActiveLinks();
  });

  it('seleciona implemento existente sem vínculo e preserva eixos/capacidade quando omitidos', async () => {
    const [destino, item] = await Promise.all([cavalo(), implemento()]);
    await service.update(destino.id, { implementos: [{ id: item.id, tipo: item.tipo, carroceria: item.carroceria }] });
    const [novo] = await ativos(destino.id);
    expect(novo).toMatchObject({ quantidadeTotalEixos: 6, capacidadeTotal: item.capacidadeCarga });
    expect(await prisma.implemento.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ quantidadeEixos: 3, capacidadeCarga: item.capacidadeCarga });
    expect(await prisma.historicoImplemento.count({ where: { acao: 'TRANSFERENCIA_IMPLEMENTO' } })).toBe(0);
  });

  it('reseleciona o implemento do próprio cavalo sem gerar transferência ou desengate externo', async () => {
    const [owner, item] = await Promise.all([cavalo(), implemento()]);
    await conjunto(owner, [item]);
    await service.update(owner.id, { implementos: [selection(item)] });
    expect(await ativos(owner.id)).toHaveLength(1);
    expect(await prisma.historicoImplemento.count({ where: { acao: 'TRANSFERENCIA_IMPLEMENTO' } })).toBe(0);
    expect(await prisma.historicoCavaloMecanico.count({ where: { acao: 'DESENGATE_IMPLEMENTO' } })).toBe(0);
    await assertNoDuplicateActiveLinks();
  });

  it('transfere uma das duas carretas e recria composição simples com a remanescente', async () => {
    const [origem, destino, first, second] = await Promise.all([cavalo(), cavalo(), implemento(), implemento(TipoImplemento.REBOQUE, 2)]);
    const antigo = await conjunto(origem, [first, second]);
    await service.update(destino.id, { implementos: [selection(first)] });
    const [restante] = await ativos(origem.id);
    expect(restante).toMatchObject({ tipo: 'SIMPLES', quantidadeTotalEixos: 5, capacidadeTotal: second.capacidadeCarga });
    expect(restante.implementos.map((link) => link.implementoId)).toEqual([second.id]);
    const oldLinks = await prisma.conjuntoImplemento.findMany({ where: { conjuntoId: antigo.id } });
    expect(oldLinks).toHaveLength(2);
    expect(oldLinks.every((link) => link.dataFim?.getTime() === restante.implementos[0].dataInicio.getTime())).toBe(true);
    expect(await prisma.conjunto.count({ where: { cavaloMecanicoId: origem.id } })).toBe(2);
    await assertNoDuplicateActiveLinks();
  });

  it('retira uma carreta do rodotrem e deixa a origem sem composição ativa quando sobra carreta+dolly', async () => {
    const [origem, destino, first, dolly, second] = await Promise.all([cavalo(), cavalo(), implemento(), implemento(TipoImplemento.DOLLY), implemento()]);
    const antigo = await conjunto(origem, [first, dolly, second]);
    await service.update(destino.id, { implementos: [selection(second)] });
    expect(await ativos(origem.id)).toEqual([]);
    expect(await prisma.conjunto.count({ where: { cavaloMecanicoId: origem.id } })).toBe(1);
    const links = await prisma.conjuntoImplemento.findMany({ where: { conjuntoId: antigo.id } });
    expect(links).toHaveLength(3);
    expect(links.every((link) => link.dataFim !== null)).toBe(true);
    expect(await prisma.implemento.count({ where: { id: { in: [first.id, dolly.id, second.id] } } })).toBe(3);
    expect(await ativos(destino.id)).toHaveLength(1);
    const history = await prisma.historicoCavaloMecanico.findFirstOrThrow({ where: { cavaloMecanicoId: origem.id, acao: 'DESENGATE_IMPLEMENTO' } });
    expect(history.dadosDepois).toMatchObject({ conjunto: null });
    await assertNoDuplicateActiveLinks();
  });

  it('cria um cavalo novo transferindo implemento já cadastrado sem duplicar o cadastro', async () => {
    const [origem, item] = await Promise.all([cavalo(), implemento()]);
    await conjunto(origem, [item]);
    const created = await service.create({ placa: 'NOV0A01', tipoCavalo: TipoCavaloMecanico.TRACADO_6X4, implementos: [selection(item)] });
    expect(created.conjuntoAtual.implementos[0].implementoId).toBe(item.id);
    expect(await prisma.implemento.count()).toBe(1);
    expect(await ativos(origem.id)).toEqual([]);
    expect(await ativos(created.id)).toHaveLength(1);
    await assertNoDuplicateActiveLinks();
  });

  it.each([StatusGeral.INATIVO, StatusGeral.MANUTENCAO])('mantém vínculo da origem quando o destino é %s e fecha o novo vínculo imediatamente', async (conjuntoStatus) => {
    const [origem, destino, item] = await Promise.all([cavalo(), cavalo(), implemento()]);
    const antigo = await conjunto(origem, [item]);
    const original = await prisma.conjunto.findUniqueOrThrow({ where: { id: antigo.id }, include: { implementos: true } });

    await service.update(destino.id, { conjuntoStatus, implementos: [selection(item)] });

    expect(await prisma.conjunto.findUniqueOrThrow({ where: { id: antigo.id }, include: { implementos: true } })).toEqual(original);
    expect(await prisma.implemento.findUniqueOrThrow({ where: { id: item.id } })).toEqual(item);
    expect(await ativos(origem.id)).toHaveLength(1);
    expect(await ativos(destino.id)).toEqual([]);
    const novo = await prisma.conjunto.findFirstOrThrow({ where: { cavaloMecanicoId: destino.id }, include: { implementos: true } });
    expect(novo.status).toBe(conjuntoStatus);
    expect(novo.implementos).toHaveLength(1);
    expect(novo.implementos[0].dataFim).toEqual(novo.implementos[0].dataInicio);
    expect(await prisma.historicoImplemento.count({ where: { acao: 'TRANSFERENCIA_IMPLEMENTO' } })).toBe(0);
    expect(await prisma.historicoCavaloMecanico.count({ where: { cavaloMecanicoId: origem.id, acao: 'DESENGATE_IMPLEMENTO' } })).toBe(0);
    await assertNoDuplicateActiveLinks();
  });

  it.each([StatusGeral.INATIVO, StatusGeral.MANUTENCAO])('rejeita alteração de implemento ocupado em composição %s e reverte a operação inteira', async (conjuntoStatus) => {
    const [origem, destino, item, antigoDestino] = await Promise.all([cavalo(), cavalo(), implemento(), implemento()]);
    await conjunto(origem, [item]);
    await conjunto(destino, [antigoDestino]);
    const before = await snapshot();

    await expect(service.update(destino.id, {
      marca: 'Não persistir', conjuntoStatus,
      implementos: [{ ...selection(item), tipo: TipoImplemento.SEMIRREBOQUE, quantidadeEixos: 2, capacidadeCarga: 50_000 }],
    })).rejects.toThrow('transfira-o para uma composição ativa');

    expect(await snapshot()).toEqual(before);
    await assertNoDuplicateActiveLinks();
  });

  it.each([
    ['três carretas', [TipoImplemento.CARRETA, TipoImplemento.CARRETA, TipoImplemento.CARRETA], TipoCavaloMecanico.TRUCADO_6X2, 3, /no máximo duas/],
    ['dois dollys', [TipoImplemento.CARRETA, TipoImplemento.DOLLY, TipoImplemento.DOLLY, TipoImplemento.CARRETA], TipoCavaloMecanico.TRUCADO_6X2, 3, /no máximo um dolly/],
    ['dolly isolado', [TipoImplemento.DOLLY], TipoCavaloMecanico.TRUCADO_6X2, 3, /acompanhado/],
    ['uma carreta e dolly', [TipoImplemento.CARRETA, TipoImplemento.DOLLY], TipoCavaloMecanico.TRUCADO_6X2, 3, /não informe dolly/],
    ['ordem incorreta', [TipoImplemento.DOLLY, TipoImplemento.CARRETA, TipoImplemento.CARRETA], TipoCavaloMecanico.TRUCADO_6X2, 3, /ordem/],
    ['rodotrem em cavalo toco', [TipoImplemento.CARRETA, TipoImplemento.DOLLY, TipoImplemento.CARRETA], TipoCavaloMecanico.SIMPLES_TOCO_4X2, 3, /trucado ou traçado/],
    ['carreta de quatro eixos', [TipoImplemento.CARRETA], TipoCavaloMecanico.TRUCADO_6X2, 4, /2 ou 3 eixos/],
  ] as const)('mantém validação de %s e não persiste alterações', async (_label, tipos, tipoCavalo, eixos, message) => {
    const [origem, destino] = await Promise.all([cavalo(), cavalo(tipoCavalo)]);
    const items = await Promise.all(tipos.map((tipo) => implemento(tipo)));
    const sourceItem = items.find((item) => item.tipo !== TipoImplemento.DOLLY);
    if (sourceItem) await conjunto(origem, [sourceItem]);
    const before = await snapshot();
    const operation = service.update(destino.id, {
      marca: 'Não persistir', implementos: items.map((item) => ({ ...selection(item), quantidadeEixos: item.tipo === TipoImplemento.DOLLY ? 2 : eixos })),
    });
    await expect(operation).rejects.toBeInstanceOf(BadRequestException);
    await expect(operation).rejects.toThrow(message);
    expect(await snapshot()).toEqual(before);
  });

  it('faz rollback de encerramentos, recriação da origem, destino e históricos quando a última etapa falha', async () => {
    const [origem, destino, first, second, oldDestination] = await Promise.all([cavalo(), cavalo(), implemento(), implemento(), implemento()]);
    await conjunto(origem, [first, second]);
    await conjunto(destino, [oldDestination]);
    const before = await snapshot();
    const original = composicoes.registrarTransferencias.bind(composicoes);
    jest.spyOn(composicoes, 'registrarTransferencias').mockImplementation(async (...args) => {
      await original(...args);
      throw new Error('Falha simulada após gravar o histórico da transferência');
    });
    await expect(service.update(destino.id, {
      marca: 'Alteração revertida', implementos: [{ ...selection(first), capacidadeCarga: 45_000 }],
    })).rejects.toThrow('Falha simulada');
    expect(await snapshot()).toEqual(before);
    await assertNoDuplicateActiveLinks();
  });

  it('preserva todos os campos de lançamentos financeiros e o snapshot histórico do conjunto', async () => {
    const [origem, destino, item, remanescente] = await Promise.all([cavalo(), cavalo(), implemento(), implemento()]);
    const antigo = await conjunto(origem, [item, remanescente]);
    const lancamento = await prisma.lancamentoFinanceiro.create({
      data: {
        data: new Date('2026-01-02T00:00:00Z'), placa: origem.placa, cavaloMecanicoId: origem.id,
        conjuntoId: antigo.id, implementoId: item.id, tipoLancamento: 'FATURAMENTO', descricao: 'Frete histórico',
        quantidade: 10_000, unidadeQuantidade: 'KG', valorUnitario: 1.25, valorTotal: 12_500,
        quantidadeEixosComissao: 9, tipoComissao: 'PERCENTUAL', percentualComissao: 10, valorComissao: 1_250,
      },
    });
    await service.update(destino.id, { implementos: [{ ...selection(item), quantidadeEixos: 2, capacidadeCarga: 20_000 }] });
    expect(await prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: lancamento.id } })).toEqual(lancamento);
    const historico = await prisma.conjunto.findUniqueOrThrow({ where: { id: antigo.id } });
    expect(historico).toMatchObject({
      nome: antigo.nome, cavaloMecanicoId: origem.id, tipo: antigo.tipo, quantidadeTotalEixos: 9,
      capacidadeTotal: antigo.capacidadeTotal, createdAt: antigo.createdAt, observacoes: antigo.observacoes,
    });
    const closed = await prisma.historicoConjuntoOperacional.findFirstOrThrow({ where: { conjuntoId: antigo.id, acao: 'ENCERRAMENTO_COMPOSICAO' } });
    expect(closed.dadosAntes).toMatchObject({ quantidadeTotalEixos: 9, capacidadeTotal: '60246.912' });
    const beforeImplementos = (closed.dadosAntes as any).implementos;
    expect(beforeImplementos[0].implemento).toMatchObject({ quantidadeEixos: 3, capacidadeCarga: '30123.456' });
  });

  it('resolve motoristas do histórico de composição nos snapshots antes e depois.cavalo', async () => {
    const [owner, item, antigoMotorista, novoMotorista] = await Promise.all([
      cavalo(), implemento(),
      prisma.motorista.create({ data: { nome: 'Motorista anterior' } }),
      prisma.motorista.create({ data: { nome: 'Motorista novo' } }),
    ]);
    await prisma.cavaloMecanico.update({ where: { id: owner.id }, data: { motoristaId: antigoMotorista.id } });
    await conjunto(owner, [item]);

    await service.update(owner.id, { motoristaId: novoMotorista.id, implementos: [selection(item)] });

    const historico = await service.historico(owner.id);
    expect(historico.alteracoes).toHaveLength(1);
    expect(historico.alteracoes[0].dadosAntes).toMatchObject({ motoristaId: antigoMotorista.id });
    expect(historico.alteracoes[0].dadosDepois).toMatchObject({ cavalo: { motoristaId: novoMotorista.id } });
    expect(historico.motoristasHistoricos.map((item) => item.id).sort()).toEqual([antigoMotorista.id, novoMotorista.id].sort());
    expect(await prisma.historicoMotorista.findMany({ orderBy: { acao: 'asc' } })).toEqual([
      expect.objectContaining({ motoristaId: antigoMotorista.id, acao: 'REMOCAO_CAVALO' }),
      expect.objectContaining({ motoristaId: novoMotorista.id, acao: 'VINCULO_CAVALO' }),
    ]);
  });

  it('reverte a transferência e troca de motorista se gravar o histórico do motorista falha', async () => {
    const [origem, destino, item, restante, antigoDestino, antigoMotorista, novoMotorista] = await Promise.all([
      cavalo(), cavalo(), implemento(), implemento(), implemento(),
      prisma.motorista.create({ data: { nome: 'Motorista anterior' } }),
      prisma.motorista.create({ data: { nome: 'Motorista novo' } }),
    ]);
    await prisma.cavaloMecanico.update({ where: { id: destino.id }, data: { motoristaId: antigoMotorista.id } });
    await conjunto(origem, [item, restante]);
    await conjunto(destino, [antigoDestino]);
    const before = await snapshot();
    const failingPrisma = prisma.$extends({
      query: {
        historicoMotorista: {
          async create({ args, query }) {
            const result = await query(args);
            if (args.data.acao === 'VINCULO_CAVALO') throw new Error('Falha simulada após escrever histórico de motorista');
            return result;
          },
        },
      },
    });
    const failingService = new CaminhoesService(failingPrisma as unknown as PrismaService, composicoes);

    await expect(failingService.update(destino.id, {
      motoristaId: novoMotorista.id, implementos: [selection(item)],
    })).rejects.toThrow('Falha simulada após escrever histórico de motorista');

    expect(await snapshot()).toEqual(before);
    await assertNoDuplicateActiveLinks();
  });

  it('bloqueia criação direta de composição com implemento que segue ativo em outro cavalo', async () => {
    const [origem, destino, item] = await Promise.all([cavalo(), cavalo(), implemento()]);
    await conjunto(origem, [item]);
    const before = await snapshot();
    await expect(conjunto(destino, [item])).rejects.toBeInstanceOf(ConflictException);
    expect(await snapshot()).toEqual(before);
    await assertNoDuplicateActiveLinks();
  });

  it.each([true, false])('serializa requisições concorrentes para o mesmo implemento (com origem ativa: %s)', async (comOrigem) => {
    const [origem, destinoB, destinoC, item] = await Promise.all([cavalo(), cavalo(), cavalo(), implemento()]);
    if (comOrigem) await conjunto(origem, [item]);
    const originalResolver = composicoes.resolverTransferencias.bind(composicoes);
    let release!: () => void;
    const bothTransactionsStarted = new Promise<void>((resolve) => { release = resolve; });
    let arrivals = 0;
    jest.spyOn(composicoes, 'resolverTransferencias').mockImplementation(async (...args) => {
      // As duas transações já leram os cavalos e estabeleceram seus snapshots.
      // A barreira força sobreposição real, sem depender de sleeps ou velocidade da máquina.
      if (++arrivals <= 2) {
        if (arrivals === 2) release();
        await bothTransactionsStarted;
      }
      return originalResolver(...args);
    });
    const originalTransaction = prisma.$transaction.bind(prisma) as any;
    const serializationFailures: string[] = [];
    jest.spyOn(prisma, '$transaction').mockImplementation(async (...args: any[]) => {
      try {
        return await originalTransaction(...args);
      } catch (error: any) {
        if (error.code === 'P2034') serializationFailures.push(error.code);
        throw error;
      }
    });

    const results = await Promise.allSettled([
      service.update(destinoB.id, { implementos: [selection(item)] }),
      service.update(destinoC.id, { implementos: [selection(item)] }),
    ]);

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(serializationFailures.length).toBeGreaterThanOrEqual(1);
    const activeLinks = await prisma.conjuntoImplemento.findMany({
      where: { implementoId: item.id, dataFim: null, conjunto: { status: 'ATIVO' } }, include: { conjunto: true },
    });
    expect(activeLinks).toHaveLength(1);
    expect([destinoB.id, destinoC.id]).toContain(activeLinks[0].conjunto.cavaloMecanicoId);
    const closedSets = await prisma.conjunto.findMany({ where: { status: 'INATIVO' }, include: { implementos: true } });
    expect(closedSets.every((set) => set.implementos.every((link) => link.dataFim !== null))).toBe(true);
    const transferCount = await prisma.historicoImplemento.count({ where: { implementoId: item.id, acao: 'TRANSFERENCIA_IMPLEMENTO' } });
    expect(transferCount).toBe(comOrigem ? 2 : 1);
    await assertNoDuplicateActiveLinks();
  });
});
