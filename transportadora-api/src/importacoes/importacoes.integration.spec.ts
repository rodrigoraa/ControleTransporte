import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, relative, sep } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, TipoComissao, TipoEntidadeImportacao } from '@prisma/client';
import * as XLSX from 'xlsx';
import { ComposicoesCavaloService } from '../caminhoes/composicoes-cavalo.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { LancamentosFinanceirosService } from '../lancamentos-financeiros/lancamentos-financeiros.service';
import { ORIGEM_IMPORTACAO_CTRC } from './importacao.constants';
import { ImportacoesService } from './importacoes.service';
import { PlanilhaLancamentosParser } from './planilha-lancamentos.parser';

jest.setTimeout(60_000);

const clusterPrefix = 'controle-transporte-importacoes-';
const postgresUser = 'import_test';
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
        reject(new Error('Não foi possível reservar a porta do PostgreSQL temporário.'));
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

const sourceRow = (overrides: Record<string, unknown> = {}) => ({
  dt_emissao: '08/10/2026', ds_placa: 'qax-2h51', vl_peso: '32.500',
  nm_pessoa_motorista: '1031 / EDSON GONCALVES', nm_pagador: '929 / EMPRESA EXEMPLO',
  vl_total: '4.850,00', cd_ctrc: '12345', nr_ctrc: '12345', ds_serie: 'A', cd_pessoa_filial: '1',
  ...overrides,
});

function arquivo(rows = [sourceRow()], extension: 'xls' | 'xlsx' = 'xls') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Exportação cliente');
  return {
    nome: `relatorio.${extension}`,
    mimeType: extension === 'xls' ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: extension === 'xls' ? 'biff8' : 'xlsx' }) as Buffer,
  };
}

describePostgres('Importação financeira - PostgreSQL temporário (POSTGRES_TEST_BIN ou instalação local)', () => {
  let clusterDirectory: string | undefined;
  let dataDirectory: string | undefined;
  let prisma: PrismaClient;
  let financeiros: LancamentosFinanceirosService;
  let service: ImportacoesService;
  let parser: PlanilhaLancamentosParser;
  const composicoes = new ComposicoesCavaloService();

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

    // Nenhuma URL configurada no projeto é usada para migração ou alteração dos fixtures.
    const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
    const cli = require.resolve('prisma/build/index.js');
    const schema = join(__dirname, '../../prisma/schema.prisma');
    execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', schema], { env, windowsHide: true, timeout: 30_000, stdio: 'pipe' });
    // Valida as estruturas novas. O histórico de migrations já contém diferenças legadas
    // em índices/defaults da frota, fora do escopo da importação.
    const migrationDiff = execFileSync(process.execPath, [cli, 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel', schema], {
      env, windowsHide: true, timeout: 30_000, stdio: 'pipe',
    }).toString().trim();
    expect(migrationDiff).not.toMatch(/mapeamentos_importacao|lancamentos_importados|TipoEntidadeImportacao/);
  });

  beforeEach(async () => {
    await prisma.lancamentoImportado.deleteMany();
    await prisma.mapeamentoImportacao.deleteMany();
    await prisma.lancamentoFinanceiro.deleteMany();
    await prisma.conjunto.deleteMany();
    await prisma.implemento.deleteMany();
    await prisma.cavaloMecanico.deleteMany();
    await prisma.motorista.deleteMany();
    await prisma.cliente.deleteMany();
    await prisma.categoriaFinanceira.deleteMany();
    await prisma.auditoria.deleteMany();
    financeiros = new LancamentosFinanceirosService(prisma as PrismaService);
    parser = new PlanilhaLancamentosParser(new ConfigService());
    service = new ImportacoesService(prisma as PrismaService, parser, financeiros);
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

  async function cadastros(eixos = 6) {
    const [cavalo, motorista, cliente] = await Promise.all([
      prisma.cavaloMecanico.create({ data: { placa: 'QAX2H51', tipoCavalo: eixos === 4 ? 'SIMPLES_TOCO_4X2' : 'TRUCADO_6X2' } }),
      prisma.motorista.create({ data: { nome: 'Edson Gonçalves' } }),
      prisma.cliente.create({ data: { nome: 'Empresa Exemplo' } }),
    ]);
    const eixosImplementos = eixos === 9 ? [3, 3] : eixos === 7 ? [2, 2] : [eixos === 4 ? 2 : 3];
    const implementos = await Promise.all(eixosImplementos.map((quantidadeEixos) => prisma.implemento.create({
      data: { tipo: 'CARRETA', quantidadeEixos, capacidadeCarga: 30_000 },
    })));
    const conjunto = await prisma.$transaction((tx) => composicoes.createConjunto(
      tx, cavalo, implementos, 'ATIVO', null, new Date('2026-10-01T00:00:00Z'),
    ));
    return { cavalo, motorista, cliente, conjunto, implementos };
  }

  async function snapshot() {
    const orderBy = { id: 'asc' as const };
    return Promise.all([
      prisma.lancamentoFinanceiro.findMany({ orderBy }), prisma.lancamentoImportado.findMany({ orderBy }),
      prisma.mapeamentoImportacao.findMany({ orderBy }), prisma.auditoria.findMany({ orderBy }),
      prisma.categoriaFinanceira.findMany({ orderBy }), prisma.motorista.findMany({ orderBy }),
      prisma.cliente.findMany({ orderBy }), prisma.cavaloMecanico.findMany({ orderBy }), prisma.conjunto.findMany({ orderBy }),
      prisma.implemento.findMany({ orderBy }), prisma.conjuntoImplemento.findMany({ orderBy }),
      prisma.historicoConjuntoOperacional.findMany({ orderBy }), prisma.historicoCavaloMecanico.findMany({ orderBy }),
      prisma.historicoImplemento.findMany({ orderBy }),
    ]);
  }

  async function transferirComposicao(dataTransferencia = '2026-10-08T00:00:00Z') {
    const seeded = await cadastros(7);
    const destino = await prisma.cavaloMecanico.create({ data: { placa: 'ABC1D23', tipoCavalo: 'TRUCADO_6X2' } });
    const novaCarreta = await prisma.implemento.create({ data: { tipo: 'CARRETA', quantidadeEixos: 3, capacidadeCarga: 30_000 } });
    const timestamp = new Date(dataTransferencia);
    const atual = await prisma.$transaction(async (tx) => {
      const transferencias = await composicoes.resolverTransferencias(tx, destino.id, seeded.implementos.map((item) => item.id), timestamp);
      const conjuntoDestino = await composicoes.createConjunto(tx, destino, seeded.implementos, 'ATIVO', null, timestamp);
      await composicoes.registrarTransferencias(tx, transferencias, conjuntoDestino, timestamp);
      return composicoes.createConjunto(tx, seeded.cavalo, [novaCarreta], 'ATIVO', null, timestamp);
    });
    return { ...seeded, atual, destino };
  }

  it('usa a composição histórica de 7 eixos e sua comissão após transferência real dos implementos', async () => {
    const seeded = await transferirComposicao();
    const file = arquivo([sourceRow({ dt_emissao: '01/10/2026' })]);
    const selecoes = [{ linha: 2, tipoComissao: TipoComissao.PERCENTUAL, descontoImpostos: true }];
    const before = await snapshot();
    const preview = await service.preview(file, { selecoes });
    expect(await snapshot()).toEqual(before);
    expect(preview.linhas[0]).toMatchObject({ status: 'PRONTO', conjunto: { id: seeded.conjunto.id }, quantidadeEixos: 7, comissaoNecessaria: true });
    expect(seeded.atual.quantidadeTotalEixos).toBe(6);
    await service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2], selecoes });
    const faturamento = await prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { tipoLancamento: 'FATURAMENTO' }, include: { despesaComissao: true } });
    expect(faturamento).toMatchObject({ conjuntoId: seeded.conjunto.id, quantidadeEixosComissao: 7 });
    expect(Number(faturamento.valorComissao)).toBe(512.16);
    expect(Number(faturamento.despesaComissao!.valorTotal)).toBe(512.16);
    expect(await prisma.conjunto.findUniqueOrThrow({ where: { id: seeded.conjunto.id } })).toMatchObject({ status: 'INATIVO', quantidadeTotalEixos: 7 });
    // O cadastro manual mantém a seleção da composição atual, mesmo com uma data antiga.
    const manual = await financeiros.create({
      data: new Date('2026-10-01T00:00:00Z'), cavaloMecanicoId: seeded.cavalo.id,
      motoristaId: seeded.motorista.id, clienteId: seeded.cliente.id, tipoLancamento: 'FATURAMENTO',
      quantidade: 32_500, unidadeQuantidade: 'KG', valorUnitario: 4_850, multiplicarQuantidade: false,
    });
    expect(manual.conjuntoId).toBe(seeded.atual.id);
    expect(manual.quantidadeEixosComissao).toBeNull();
  });

  it.each(['08/10/2026', '09/10/2026'])('usa a nova composição em %s, respeitando o fim exclusivo do vínculo anterior', async (data) => {
    const seeded = await transferirComposicao();
    const file = arquivo([sourceRow({ dt_emissao: data })]);
    const preview = await service.preview(file);
    expect(preview.linhas[0]).toMatchObject({ status: 'PRONTO', conjunto: { id: seeded.atual.id }, quantidadeEixos: 6, comissaoNecessaria: false });
    await service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] });
    expect(await prisma.lancamentoFinanceiro.findFirstOrThrow()).toMatchObject({ conjuntoId: seeded.atual.id, quantidadeEixosComissao: null });
  });

  it('mantém pendente uma troca intradia porque a planilha não informa o horário do faturamento', async () => {
    await transferirComposicao('2026-10-08T10:30:00Z');
    const file = arquivo();
    const before = await snapshot();
    const preview = await service.preview(file);
    expect(preview.linhas[0]).toMatchObject({ status: 'PENDENTE_COMPOSICAO', conjunto: null, quantidadeEixos: null });
    await expect(service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('não usa a composição atual como fallback antes do primeiro vínculo conhecido', async () => {
    await cadastros(7);
    const file = arquivo([sourceRow({ dt_emissao: '30/09/2026' })]);
    const before = await snapshot();
    const preview = await service.preview(file);
    expect(preview.linhas[0]).toMatchObject({ status: 'PENDENTE_COMPOSICAO', conjunto: null, quantidadeEixos: null });
    expect(preview.resumo.pendentes).toBe(1);
    await expect(service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('revalida sobreposição histórica na confirmação e não escolhe um conjunto arbitrário', async () => {
    const seeded = await cadastros(7);
    const file = arquivo();
    const selecoes = [{ linha: 2, tipoComissao: TipoComissao.POR_VIAGEM }];
    const original = await service.preview(file, { selecoes });
    expect(original.linhas[0].status).toBe('PRONTO');
    const novosImplementos = await Promise.all([1, 2].map(() => prisma.implemento.create({ data: { tipo: 'CARRETA', quantidadeEixos: 3 } })));
    // Simula períodos legados sobrepostos mantendo vínculos e snapshots reais da frota.
    await prisma.$transaction(async (tx) => {
      await composicoes.encerrarConjunto(tx, seeded.conjunto, new Date('2026-10-10T00:00:00Z'), 'Período legado');
      await composicoes.createConjunto(tx, seeded.cavalo, novosImplementos, 'ATIVO', null, new Date('2026-10-02T00:00:00Z'));
    });
    const before = await snapshot();
    const preview = await service.preview(file, { selecoes });
    expect(preview.linhas[0]).toMatchObject({ status: 'PENDENTE_COMPOSICAO', conjunto: null, quantidadeEixos: null });
    await expect(service.confirmar(file, { hashArquivo: original.hashArquivo, linhasSelecionadas: [2], selecoes })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('protege o importado e sua comissão contra edição/exclusão comuns e permite consultar os dados', async () => {
    await cadastros(7);
    const file = arquivo();
    const selecoes = [{ linha: 2, tipoComissao: TipoComissao.PERCENTUAL, descontoImpostos: true }];
    const preview = await service.preview(file, { selecoes });
    await service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2], selecoes });
    const registro = await prisma.lancamentoImportado.findFirstOrThrow();
    const financeiro = await financeiros.findOne(registro.lancamentoFinanceiroId);
    expect(financeiro.importacao).toEqual({ id: registro.id });
    expect((await financeiros.findAll({ page: 1, limit: 10 })).data).toContainEqual(expect.objectContaining({ id: financeiro.id, importacao: { id: registro.id } }));
    const before = await snapshot();
    await expect(financeiros.update(financeiro.id, { valorUnitario: 6_000 })).rejects.toThrow('não pode ser editado diretamente');
    await expect(financeiros.remove(financeiro.id)).rejects.toThrow('não pode ser excluído');
    await expect(financeiros.update(financeiro.despesaComissao.id, { valorUnitario: 6_000 })).rejects.toThrow('despesa de comissão é automática');
    expect(await snapshot()).toEqual(before);
    expect(await financeiros.findOne(financeiro.id)).toMatchObject({ valorTotal: financeiro.valorTotal, importacao: { id: registro.id } });
  });

  it('mantém a edição manual e recalcula sua despesa de comissão sem criar vínculo de importação', async () => {
    const seeded = await cadastros(7);
    const manual = await financeiros.create({
      data: new Date('2026-10-08T00:00:00Z'), cavaloMecanicoId: seeded.cavalo.id,
      motoristaId: seeded.motorista.id, clienteId: seeded.cliente.id, tipoLancamento: 'FATURAMENTO',
      quantidade: 32_500, unidadeQuantidade: 'KG', valorUnitario: 4_850, multiplicarQuantidade: false,
      tipoComissao: TipoComissao.PERCENTUAL, descontoImpostos: true,
    });
    const updated = await financeiros.update(manual.id, { valorUnitario: 6_000 });
    expect(Number(updated.valorTotal)).toBe(6_000);
    expect(Number(updated.valorComissao)).toBe(633.6);
    expect(updated.despesaComissao!.id).toBe(manual.despesaComissao!.id);
    expect(Number(updated.despesaComissao!.valorTotal)).toBe(633.6);
    expect((await financeiros.findOne(manual.id)).importacao).toBeNull();
    expect(await prisma.lancamentoImportado.count()).toBe(0);
  });

  it.each(['xls', 'xlsx'] as const)('importa arquivo %s real preservando calendário, valor total e rastreabilidade', async (extension) => {
    const seeded = await cadastros();
    const file = arquivo([sourceRow()], extension);
    const before = await snapshot();
    const preview = await service.preview(file);
    expect(await snapshot()).toEqual(before);
    expect(preview.resumo).toMatchObject({ total: 1, prontas: 1, duplicadas: 0, pendentes: 0, invalidas: 0 });
    expect(preview.linhas[0]).toMatchObject({ data: '2026-10-08', placa: 'QAX2H51', peso: '32500', valor: '4850', status: 'PRONTO' });

    expect(await service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] }, { sub: 'admin-teste' }))
      .toEqual({ importados: 1, duplicadosIgnorados: 0, erros: 0 });
    const financeiro = await prisma.lancamentoFinanceiro.findFirstOrThrow();
    expect(financeiro).toMatchObject({
      data: new Date('2026-10-08T00:00:00.000Z'), placa: 'QAX2H51', cavaloMecanicoId: seeded.cavalo.id,
      conjuntoId: seeded.conjunto.id, motoristaId: seeded.motorista.id, clienteId: seeded.cliente.id,
      tipoLancamento: 'FATURAMENTO', unidadeQuantidade: 'KG', multiplicarQuantidade: false, tipoComissao: null,
    });
    expect(Number(financeiro.quantidade)).toBe(32_500);
    expect(Number(financeiro.valorUnitario)).toBe(4_850);
    expect(Number(financeiro.valorTotal)).toBe(4_850);
    const importado = await prisma.lancamentoImportado.findFirstOrThrow();
    expect(importado).toMatchObject({
      origem: ORIGEM_IMPORTACAO_CTRC, chaveExterna: 'ctrc:12345', lancamentoFinanceiroId: financeiro.id,
      nomeArquivo: file.nome, hashArquivo: preview.hashArquivo, usuarioId: 'admin-teste',
    });
    expect(importado.dadosOriginais).toMatchObject({ dt_emissao: '08/10/2026', vl_peso: '32.500', vl_total: '4.850,00' });
    expect(importado.hashDados).toMatch(/^[a-f0-9]{64}$/);
    expect(await prisma.mapeamentoImportacao.count()).toBe(2);
    const audits = await prisma.auditoria.findMany();
    expect(audits).toHaveLength(4);
    expect(audits.every((item) => item.usuarioId === 'admin-teste')).toBe(true);
    expect(audits.map((item) => item.acao)).toEqual(expect.arrayContaining(['CRIACAO', 'IMPORTACAO', 'ASSOCIACAO_IMPORTACAO']));
  });

  it.each([4, 7, 9])('gera exatamente o mesmo faturamento e comissão de um cadastro manual equivalente para %s eixos', async (eixos) => {
    const seeded = await cadastros(eixos);
    const file = arquivo();
    const pending = await service.preview(file);
    expect(pending.linhas[0]).toMatchObject({ status: 'PENDENTE_COMISSAO', quantidadeEixos: eixos, comissaoNecessaria: true });
    expect(await prisma.lancamentoFinanceiro.count()).toBe(0);
    const selecoes = [{ linha: 2, tipoComissao: TipoComissao.PERCENTUAL, descontoImpostos: true }];
    const preview = await service.preview(file, { selecoes });
    expect(preview.linhas[0].status).toBe('PRONTO');
    await service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2], selecoes }, { id: 'admin-teste' });
    const importado = await prisma.lancamentoImportado.findFirstOrThrow({ include: { lancamentoFinanceiro: { include: { despesaComissao: true } } } });
    const manual = await financeiros.create({
      data: new Date('2026-10-08T00:00:00Z'), cavaloMecanicoId: seeded.cavalo.id, motoristaId: seeded.motorista.id,
      clienteId: seeded.cliente.id, tipoLancamento: 'FATURAMENTO', quantidade: 32_500, unidadeQuantidade: 'KG',
      valorUnitario: 4_850, multiplicarQuantidade: false, tipoComissao: TipoComissao.PERCENTUAL, descontoImpostos: true,
    });
    const billingFields = (row: any) => Object.fromEntries([
      'data', 'placa', 'cavaloMecanicoId', 'conjuntoId', 'motoristaId', 'clienteId', 'tipoLancamento', 'quantidade',
      'unidadeQuantidade', 'valorUnitario', 'multiplicarQuantidade', 'valorTotal', 'tipoComissao', 'percentualComissao',
      'valorComissaoPorViagem', 'descontoImpostos', 'valorComissaoBruta', 'valorDescontoImpostos', 'valorComissao', 'quantidadeEixosComissao',
    ].map((field) => [field, row[field]]));
    expect(billingFields(importado.lancamentoFinanceiro)).toEqual(billingFields(manual));
    expect(importado.lancamentoFinanceiro.despesaComissao!.valorTotal).toEqual(manual.despesaComissao!.valorTotal);
    expect(await prisma.auditoria.count({ where: { acao: 'CRIACAO_COMISSAO', entidadeId: importado.lancamentoFinanceiro.despesaComissao!.id } })).toBe(1);
  });

  it('ignora reimportação idêntica e bloqueia alterações nos dados de um CTRC já importado', async () => {
    await cadastros();
    const file = arquivo();
    const preview = await service.preview(file);
    const options = { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] };
    await service.confirmar(file, options);
    const before = await snapshot();
    expect((await service.preview(file)).linhas[0].status).toBe('DUPLICADO');
    expect(await service.confirmar(file, options)).toEqual({ importados: 0, duplicadosIgnorados: 1, erros: 0 });
    expect(await snapshot()).toEqual(before);
    const changed = arquivo([sourceRow({ vl_total: '4.999,99' })]);
    const conflict = await service.preview(changed);
    expect(conflict.linhas[0].status).toBe('CONFLITO');
    await expect(service.confirmar(changed, { hashArquivo: conflict.hashArquivo, linhasSelecionadas: [2] })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('detecta repetições dentro do arquivo e importa o documento uma única vez', async () => {
    await cadastros();
    const file = arquivo([sourceRow(), sourceRow()]);
    const preview = await service.preview(file);
    expect(preview.linhas.map((item) => item.status)).toEqual(['PRONTO', 'DUPLICADO_ARQUIVO']);
    expect(await service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2, 3] }))
      .toEqual({ importados: 1, duplicadosIgnorados: 1, erros: 0 });
    expect(await prisma.lancamentoImportado.count()).toBe(1);
    expect(await prisma.lancamentoFinanceiro.count()).toBe(1);
  });

  it('preserva conflito de associação mesmo quando o CTRC já foi importado', async () => {
    await cadastros();
    const file = arquivo();
    const preview = await service.preview(file);
    await service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] });
    const outroMotorista = await prisma.motorista.create({ data: { nome: 'Outro motorista' } });
    const selecoes = [{ linha: 2, motoristaId: outroMotorista.id }];
    const before = await snapshot();
    const conflict = await service.preview(file, { selecoes });
    expect(conflict.linhas[0].status).toBe('CONFLITO');
    expect(conflict.linhas[0].pendencias.join(' ')).toContain('outro mapeamento confirmado');
    await expect(service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2], selecoes })).rejects.toMatchObject({
      response: { statusCode: 400, message: expect.arrayContaining([expect.stringContaining('outro mapeamento confirmado')]) },
    });
    expect(await snapshot()).toEqual(before);
  });

  it('bloqueia chaves repetidas com valores divergentes sem importar parte do lote', async () => {
    await cadastros();
    const file = arquivo([sourceRow(), sourceRow({ vl_total: 5000 })]);
    const before = await snapshot();
    const preview = await service.preview(file);
    expect(preview.linhas.map((item) => item.status)).toEqual(['CONFLITO', 'CONFLITO']);
    await expect(service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2, 3] })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('sugere nome semelhante sem associar automaticamente e reutiliza o código confirmado em importações futuras', async () => {
    const seeded = await cadastros();
    const gleison = await prisma.motorista.create({ data: { nome: 'Gleison Pereira' } });
    const file = arquivo([sourceRow({ nm_pessoa_motorista: '1031 / GLEISSON PEREIRA' })]);
    const pending = await service.preview(file);
    expect(pending.linhas[0]).toMatchObject({ status: 'PENDENTE_MOTORISTA', motorista: null });
    expect(pending.linhas[0].sugestoesMotorista.map((item) => item.id)).toContain(gleison.id);
    expect(await prisma.mapeamentoImportacao.count()).toBe(0);
    const selecoes = [{ linha: 2, motoristaId: gleison.id, clienteId: seeded.cliente.id }];
    await service.confirmar(file, { hashArquivo: pending.hashArquivo, linhasSelecionadas: [2], selecoes }, { id: 'admin-teste' });
    const mappings = await prisma.mapeamentoImportacao.findMany();
    expect(mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ origem: ORIGEM_IMPORTACAO_CTRC, codigoExterno: '1031', tipoEntidade: 'MOTORISTA', motoristaId: gleison.id, criadoPorId: 'admin-teste' }),
      expect.objectContaining({ origem: ORIGEM_IMPORTACAO_CTRC, codigoExterno: '929', tipoEntidade: 'CLIENTE', clienteId: seeded.cliente.id }),
    ]));
    const next = await service.preview(arquivo([sourceRow({ cd_ctrc: '12346', nm_pessoa_motorista: '1031 / NOME ALTERADO', nm_pagador: '929 / OUTRA GRAFIA' })]));
    expect(next.linhas[0]).toMatchObject({ status: 'PRONTO', motorista: { id: gleison.id }, cliente: { id: seeded.cliente.id } });
    expect(await prisma.motorista.count()).toBe(2);
    expect(await prisma.cliente.count()).toBe(1);
  });

  it('mantém associação ambígua pendente e não cria cavalo ao receber placa inexistente', async () => {
    await cadastros();
    await prisma.motorista.create({ data: { nome: 'EDSON GONCALVES' } });
    const before = await snapshot();
    const ambiguous = await service.preview(arquivo());
    expect(ambiguous.linhas[0]).toMatchObject({ status: 'PENDENTE_MOTORISTA', motorista: null });
    expect(ambiguous.linhas[0].sugestoesMotorista).toHaveLength(2);
    const missing = await service.preview(arquivo([sourceRow({ ds_placa: 'SEM0A00' })]));
    expect(missing.linhas[0]).toMatchObject({ status: 'PLACA_NAO_ENCONTRADA', cavalo: null });
    expect(missing.linhas[0].pendencias).toContain('Cavalo SEM0A00 não encontrado.');
    expect(await snapshot()).toEqual(before);
  });

  it('revalida entidades e hash do arquivo durante a confirmação', async () => {
    const seeded = await cadastros();
    const file = arquivo();
    const preview = await service.preview(file);
    const changed = arquivo([sourceRow({ vl_total: 5000 })]);
    await expect(service.confirmar(changed, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] })).rejects.toThrow('arquivo é diferente');
    await prisma.motorista.delete({ where: { id: seeded.motorista.id } });
    const before = await snapshot();
    await expect(service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('reverte lote inteiro, comissões, mapeamentos e auditorias após falha na segunda linha', async () => {
    await cadastros(7);
    const file = arquivo([sourceRow(), sourceRow({ cd_ctrc: '12346' })]);
    const selecoes = [2, 3].map((linha) => ({ linha, tipoComissao: TipoComissao.POR_VIAGEM }));
    const preview = await service.preview(file, { selecoes });
    const before = await snapshot();
    const original = financeiros.createInTransaction.bind(financeiros);
    let writes = 0;
    jest.spyOn(financeiros, 'createInTransaction').mockImplementation(async (...args) => {
      const row = await original(...args);
      if (++writes === 2) throw new Error('Falha após gravar a segunda linha');
      return row;
    });
    await expect(service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2, 3], selecoes })).rejects.toThrow('Falha após gravar');
    expect(writes).toBe(2);
    expect(await snapshot()).toEqual(before);
  });

  it('reverte os registros financeiros quando a auditoria da importação falha', async () => {
    await cadastros(7);
    const file = arquivo();
    const selecoes = [{ linha: 2, tipoComissao: TipoComissao.PERCENTUAL }];
    const preview = await service.preview(file, { selecoes });
    const before = await snapshot();
    const failingPrisma = prisma.$extends({ query: { auditoria: { async create({ args, query }) {
      const row = await query(args);
      if (args.data.acao === 'IMPORTACAO') throw new Error('Falha ao auditar importação');
      return row;
    } } } });
    const db = failingPrisma as unknown as PrismaService;
    const failingService = new ImportacoesService(db, parser, new LancamentosFinanceirosService(db));
    await expect(failingService.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2], selecoes })).rejects.toThrow('Falha ao auditar');
    expect(await snapshot()).toEqual(before);
  });

  it('garante no banco unicidade das chaves e associação exclusiva de motorista ou cliente', async () => {
    const seeded = await cadastros();
    const mapping = { origem: ORIGEM_IMPORTACAO_CTRC, codigoExterno: '1031', nomeExterno: 'EDSON', tipoEntidade: TipoEntidadeImportacao.MOTORISTA };
    await expect(prisma.mapeamentoImportacao.create({ data: mapping })).rejects.toThrow('entidade_check');
    await expect(prisma.mapeamentoImportacao.create({ data: { ...mapping, motoristaId: seeded.motorista.id, clienteId: seeded.cliente.id } })).rejects.toThrow('entidade_check');
    await prisma.mapeamentoImportacao.create({ data: { ...mapping, motoristaId: seeded.motorista.id } });
    await expect(prisma.mapeamentoImportacao.create({ data: { ...mapping, motoristaId: seeded.motorista.id } })).rejects.toMatchObject({ code: 'P2002' });
    const file = arquivo();
    const preview = await service.preview(file);
    await service.confirmar(file, { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] });
    const imported = await prisma.lancamentoImportado.findFirstOrThrow();
    await expect(prisma.lancamentoImportado.create({ data: { ...imported, dadosOriginais: {}, id: 'outro-importado' } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.lancamentoFinanceiro.delete({ where: { id: imported.lancamentoFinanceiroId } })).rejects.toThrow('lancamentos_importados_lancamentoFinanceiroId_fkey');
    await expect(financeiros.remove(imported.lancamentoFinanceiroId)).rejects.toThrow('preservar a rastreabilidade');
    await expect(prisma.motorista.delete({ where: { id: seeded.motorista.id } })).rejects.toThrow('mapeamentos_importacao_motoristaId_fkey');
    expect(await prisma.lancamentoFinanceiro.count()).toBe(1);
  });

  it('confirma simultaneamente o mesmo CTRC com retry real e somente um faturamento persistido', async () => {
    await cadastros();
    const file = arquivo();
    const preview = await service.preview(file);
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    let arrivals = 0;
    const originalValidation = financeiros.validateInTransaction.bind(financeiros);
    jest.spyOn(financeiros, 'validateInTransaction').mockImplementation(async (...args) => {
      const result = await originalValidation(...args);
      if (++arrivals <= 2) {
        if (arrivals === 2) release();
        await barrier;
      }
      return result;
    });
    const originalTransaction = prisma.$transaction.bind(prisma) as any;
    const failures: string[] = [];
    jest.spyOn(prisma, '$transaction').mockImplementation(async (...args: any[]) => {
      try { return await originalTransaction(...args); }
      catch (error: any) {
        if (['P2002', 'P2034'].includes(error.code)) failures.push(error.code);
        throw error;
      }
    });
    const options = { hashArquivo: preview.hashArquivo, linhasSelecionadas: [2] };
    const results = await Promise.all([service.confirmar(file, options), service.confirmar(file, options)]);
    expect(results.reduce((total, item) => total + item.importados, 0)).toBe(1);
    expect(results.reduce((total, item) => total + item.duplicadosIgnorados, 0)).toBe(1);
    expect(failures.length).toBeGreaterThanOrEqual(1);
    expect(await prisma.lancamentoFinanceiro.count()).toBe(1);
    expect(await prisma.lancamentoImportado.count()).toBe(1);
    expect(await prisma.mapeamentoImportacao.count()).toBe(2);
    expect(await prisma.auditoria.count({ where: { acao: 'IMPORTACAO' } })).toBe(1);
  });
});
