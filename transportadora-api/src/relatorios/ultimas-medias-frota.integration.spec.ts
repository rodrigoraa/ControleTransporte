import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, relative, sep } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RelatoriosService } from './relatorios.service';

jest.setTimeout(60_000);

const clusterPrefix = 'controle-transporte-ultimas-medias-';
const postgresUser = 'latest_fleet_test';
const executable = (name: string) => `${name}${process.platform === 'win32' ? '.exe' : ''}`;
const candidates = [
  process.env.POSTGRES_TEST_BIN,
  ...(process.platform === 'win32'
    ? [join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL', '18', 'bin')]
    : [18, 17, 16, 15].map((version) => `/usr/lib/postgresql/${version}/bin`)),
].filter((candidate): candidate is string => Boolean(candidate));
const postgresBin = candidates.find((candidate) => ['initdb', 'pg_ctl', 'postgres'].every((name) => existsSync(join(candidate, executable(name)))));
const describePostgres = postgresBin ? describe : describe.skip;

async function availablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Não foi possível reservar uma porta local para o teste.'));
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
  const parent = realpathSync(tmpdir());
  const child = relative(parent, target);
  if (!child.startsWith(clusterPrefix) || child.includes(sep) || basename(target) !== child) {
    throw new Error('O diretório de teste não é um filho temporário autorizado para remoção.');
  }
  rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

describePostgres('Últimas médias da frota - PostgreSQL temporário (POSTGRES_TEST_BIN ou instalação local)', () => {
  let clusterDirectory: string | undefined;
  let dataDirectory: string | undefined;
  let prisma: PrismaClient | undefined;
  let service: RelatoriosService;
  const queries: string[] = [];
  const filters = { tipoRelatorio: 'ULTIMAS_MEDIAS_FROTA' as const };

  beforeAll(async () => {
    clusterDirectory = mkdtempSync(join(realpathSync(tmpdir()), clusterPrefix));
    dataDirectory = join(clusterDirectory, 'data');
    const port = await availablePort();
    runPostgres('initdb', ['-D', dataDirectory, '--username', postgresUser, '--auth=trust', '--encoding=UTF8', '--no-locale', '--no-sync']);
    runPostgres('pg_ctl', [
      '-D', dataDirectory, '-l', join(clusterDirectory, 'postgres.log'), '-o',
      `-h 127.0.0.1 -p ${port} -F -c unix_socket_directories= -c timezone=UTC`, '-w', '-t', '20', 'start',
    ]);

    // O datasource é exclusivo deste cluster, independentemente da configuração do projeto.
    const clientOptions: Prisma.PrismaClientOptions = {
      datasources: { db: { url: `postgresql://${postgresUser}@127.0.0.1:${port}/postgres?schema=public&connection_limit=2&connect_timeout=5&pool_timeout=5` } },
      log: [{ emit: 'event', level: 'query' }],
    };
    const client = new PrismaClient(clientOptions);
    prisma = client;
    client.$on('query' as never, (event: Prisma.QueryEvent) => queries.push(event.query));
    await client.$connect();
    const identity = await client.$queryRaw<Array<{ directory: string; port: number; usuario: string }>>`
      SELECT current_setting('data_directory') AS directory, inet_server_port() AS port, current_user AS usuario
    `;
    expect(identity[0].port).toBe(port);
    expect(identity[0].usuario).toBe(postgresUser);
    expect(realpathSync(identity[0].directory)).toBe(realpathSync(dataDirectory));

    await client.$executeRaw`
      CREATE TABLE "cavalos_mecanicos" (
        "id" TEXT PRIMARY KEY, "placa" TEXT NOT NULL UNIQUE, "marca" TEXT, "modelo" TEXT
      )
    `;
    await client.$executeRaw`
      CREATE TABLE "abastecimentos" (
        "id" TEXT PRIMARY KEY, "cavaloMecanicoId" TEXT NOT NULL REFERENCES "cavalos_mecanicos"("id"),
        "data" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL,
        "kmAnterior" DECIMAL(12,1) NOT NULL, "kmAtual" DECIMAL(12,1) NOT NULL,
        "distanciaPercorrida" DECIMAL(12,1) NOT NULL, "litros" DECIMAL(12,3) NOT NULL,
        "mediaKmLitro" DECIMAL(12,3) NOT NULL, "observacoes" TEXT
      )
    `;
    await client.$executeRaw`
      CREATE INDEX "abastecimentos_cavaloMecanicoId_data_idx" ON "abastecimentos"("cavaloMecanicoId", "data")
    `;
    // IDs e placas são fictícios; a ordem de inserção não é a ordem de apresentação.
    const cavalos = [
      ['cav-d', 'JKL0D12'], ['cav-sem', 'SEM0A00'], ['cav-b', 'DEF4B56'],
      ['cav-e', 'MNO3E45'], ['cav-a', 'ABC1A23'], ['cav-c', 'GHI7C89'],
    ];
    for (const [id, placa] of cavalos) {
      await client.$executeRaw`INSERT INTO "cavalos_mecanicos"("id", "placa", "marca", "modelo") VALUES (${id}, ${placa}, 'Marca fictícia', 'Modelo fictício')`;
    }
    const abastecimentos = [
      { id: 'ab-a-antigo', cavalo: 'cav-a', data: '2026-09-01', criado: '2026-10-05T08:00:00Z', media: '9.876' },
      { id: 'ab-a-ultimo', cavalo: 'cav-a', data: '2026-10-01', criado: '2026-10-01T08:00:00Z', media: '2.920' },
      { id: 'ab-b-antigo', cavalo: 'cav-b', data: '2026-09-05', criado: '2026-09-05T08:00:00Z', media: '2.800' },
      { id: 'ab-b-ultimo', cavalo: 'cav-b', data: '2026-09-30', criado: '2026-09-30T08:00:00Z', media: '3.050' },
      { id: 'ab-c-z', cavalo: 'cav-c', data: '2026-09-28', criado: '2026-09-28T08:00:00Z', media: '2.710' },
      { id: 'ab-c-a', cavalo: 'cav-c', data: '2026-09-28', criado: '2026-09-28T09:00:00Z', media: '2.880' },
      { id: 'ab-d-z', cavalo: 'cav-d', data: '2026-09-27', criado: '2026-09-27T08:00:00Z', media: '3.990' },
      { id: 'ab-d-a', cavalo: 'cav-d', data: '2026-09-27', criado: '2026-09-27T08:00:00Z', media: '3.500' },
      { id: 'ab-e-unico', cavalo: 'cav-e', data: '2026-09-26', criado: '2026-09-26T08:00:00Z', media: '2.450' },
    ];
    for (const registro of abastecimentos) {
      await client.$executeRaw`
        INSERT INTO "abastecimentos"("id", "cavaloMecanicoId", "data", "createdAt", "kmAnterior", "kmAtual", "distanciaPercorrida", "litros", "mediaKmLitro", "observacoes")
        VALUES (${registro.id}, ${registro.cavalo}, ${new Date(`${registro.data}T00:00:00Z`)}, ${new Date(registro.criado)},
          1000.1, 1600.3, 600.2, 200.123, ${new Prisma.Decimal(registro.media)}, ${registro.id})
      `;
    }
    service = new RelatoriosService(client as PrismaService);
  });

  beforeEach(() => { queries.length = 0; });

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

  it('retorna somente o mais recente por cavalo, com datas distintas e placas em ordem alfabética', async () => {
    const result = await service.financeiros(filters);
    expect(queries).toHaveLength(1);
    expect(result.ultimasMedias.registros.map((item: any) => [item.placa, item.id, item.data.toISOString().slice(0, 10)])).toEqual([
      ['ABC1A23', 'ab-a-ultimo', '2026-10-01'], ['DEF4B56', 'ab-b-ultimo', '2026-09-30'],
      ['GHI7C89', 'ab-c-a', '2026-09-28'], ['JKL0D12', 'ab-d-z', '2026-09-27'], ['MNO3E45', 'ab-e-unico', '2026-09-26'],
    ]);
    expect(result.ultimasMedias.resumo).toEqual({
      cavalosComMedia: 5, dataMaisRecente: new Date('2026-10-01T00:00:00Z'), dataMaisAntiga: new Date('2026-09-26T00:00:00Z'),
    });
  });

  it('desempata pela criação antes do ID, mesmo quando o ID do registro mais antigo é maior', async () => {
    const result = await service.financeiros({ ...filters, cavaloMecanicoId: 'cav-c' });
    expect(result.ultimasMedias.registros).toHaveLength(1);
    expect(result.ultimasMedias.registros[0]).toMatchObject({ id: 'ab-c-a', mediaKmLitro: 2.88 });
  });

  it('desempata pelo ID quando data e criação coincidem, independentemente da ordem de inserção', async () => {
    const result = await service.financeiros({ ...filters, cavaloMecanicoId: 'cav-d' });
    expect(result.ultimasMedias.registros).toHaveLength(1);
    expect(result.ultimasMedias.registros[0]).toMatchObject({ id: 'ab-d-z', mediaKmLitro: 3.99 });
  });

  it('inclui um cavalo com abastecimento único e omite cavalo sem abastecimentos sem criar média zero', async () => {
    const single = await service.financeiros({ ...filters, cavaloMecanicoId: 'cav-e' });
    expect(single.ultimasMedias.registros).toHaveLength(1);
    expect(single.ultimasMedias.registros[0]).toMatchObject({ id: 'ab-e-unico', mediaKmLitro: 2.45 });
    const empty = await service.financeiros({ ...filters, cavaloMecanicoId: 'cav-sem' });
    expect(empty.ultimasMedias).toEqual({ registros: [], resumo: { cavalosComMedia: 0, dataMaisRecente: null, dataMaisAntiga: null } });
  });

  it('preserva a média persistida e os campos do último abastecimento sem recalcular distância/litros', async () => {
    const result = await service.financeiros({ ...filters, cavaloMecanicoId: 'cav-a' });
    const row = result.ultimasMedias.registros[0];
    expect(row).toMatchObject({ id: 'ab-a-ultimo', kmAnterior: 1000.1, kmAtual: 1600.3, distanciaPercorrida: 600.2, litros: 200.123, mediaKmLitro: 2.92 });
    expect(row.mediaKmLitro).not.toBeCloseTo(row.distanciaPercorrida / row.litros, 3);
  });

  it('filtra por placa parcial, IDs e combinação dos filtros usando parâmetros', async () => {
    const plate = await service.financeiros({ ...filters, placa: 'def' });
    expect(plate.ultimasMedias.registros.map((item: any) => item.placa)).toEqual(['DEF4B56']);
    const ids = await service.financeiros({ ...filters, cavaloMecanicoIds: ' cav-a, cav-e ' });
    expect(ids.ultimasMedias.registros.map((item: any) => item.placa)).toEqual(['ABC1A23', 'MNO3E45']);
    const combined = await service.financeiros({ ...filters, cavaloMecanicoIds: 'cav-a,cav-e', placa: 'mno' });
    expect(combined.ultimasMedias.registros.map((item: any) => item.placa)).toEqual(['MNO3E45']);
    const injection = await service.financeiros({ ...filters, cavaloMecanicoId: "' OR 1=1 --", placa: "' OR TRUE --" });
    expect(injection.ultimasMedias.registros).toEqual([]);
  });

  it('ignora datas residuais e filtros financeiros e mantém opções de cavalos com abastecimentos', async () => {
    const expected = await service.financeiros(filters);
    const residual = { ...filters, dataInicial: '2020-01-01', dataFinal: '2020-01-02', fornecedorId: 'for-inexistente', motoristaId: 'mot-inexistente' };
    expect(await service.financeiros(residual)).toEqual(expected);
    const options = await service.opcoes({ ...residual, cavaloMecanicoId: 'cav-e' });
    expect(options.cavalosMecanicos.map((option: any) => option.value)).toEqual(['cav-a', 'cav-b', 'cav-c', 'cav-d', 'cav-e']);
  });
});
