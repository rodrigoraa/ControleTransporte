import 'reflect-metadata';
import { HttpException, Module } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { PerfilUsuario } from '@prisma/client';
import fastify, { FastifyInstance } from 'fastify';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { IMPORT_MAX_OPTIONS_BYTES } from './importacao.constants';
import { ImportacoesController } from './importacoes.controller';
import { ImportacoesService } from './importacoes.service';

function body(parts: Array<{ name: string; value: string | Buffer; filename?: string; mime?: string }>) {
  const boundary = 'controle-transporte-test-boundary';
  const buffers: Buffer[] = [];
  for (const part of parts) {
    const disposition = 'Content-Disposition: form-data; name="' + part.name + '"' + (part.filename ? '; filename="' + part.filename + '"' : '');
    buffers.push(Buffer.from('--' + boundary + '\r\n' + disposition + '\r\n' + (part.filename ? 'Content-Type: ' + (part.mime || 'application/vnd.ms-excel') + '\r\n' : '') + '\r\n'));
    buffers.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
    buffers.push(Buffer.from('\r\n'));
  }
  buffers.push(Buffer.from('--' + boundary + '--\r\n'));
  return { payload: Buffer.concat(buffers), headers: { 'content-type': 'multipart/form-data; boundary=' + boundary } };
}

describe('ImportacoesController multipart Fastify', () => {
  let app: FastifyInstance;
  let service: any;
  const actor = { id: 'admin-1' };
  beforeEach(async () => {
    app = fastify();
    await app.register(multipart, { throwFileSizeLimit: true });
    service = { preview: jest.fn().mockResolvedValue({ resumo: { prontas: 1 } }), confirmar: jest.fn().mockResolvedValue({ importados: 1 }) };
    const controller = new ImportacoesController(service, new ConfigService({ IMPORT_MAX_FILE_BYTES: 1024 }));
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof HttpException) reply.code(error.getStatus()).send(error.getResponse());
      else reply.code(500).send({ message: (error as Error).message });
    });
    app.post('/preview', (request) => controller.preview(request, actor));
    app.post('/confirmar', (request) => controller.confirmar(request, actor));
    await app.ready();
  });
  afterEach(async () => { await app.close(); });

  it('exige autenticação e perfil Admin para preview e confirmação', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ImportacoesController)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, ImportacoesController)).toEqual([PerfilUsuario.ADMIN]);
  });

  it.each(['/preview', '/confirmar'])('recebe arquivo e opções em %s sem salvar arquivo em disco', async (url) => {
    const upload = body([
      { name: 'opcoes', value: JSON.stringify({ hashArquivo: 'a'.repeat(64) }) },
      { name: 'arquivo', filename: 'relatorio.xls', value: Buffer.from('planilha-binaria') },
    ]);
    const result = await app.inject({ method: 'POST', url, ...upload });
    expect(result.statusCode).toBe(200);
    const method = url === '/preview' ? service.preview : service.confirmar;
    expect(method).toHaveBeenCalledWith(
      { nome: 'relatorio.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('planilha-binaria') },
      { hashArquivo: 'a'.repeat(64) }, actor,
    );
  });

  it('aceita as opções depois do arquivo e assume objeto vazio quando ausentes', async () => {
    const file = { name: 'arquivo', filename: 'relatorio.xls', value: 'conteudo' };
    const result = await app.inject({ method: 'POST', url: '/preview', ...body([file, { name: 'opcoes', value: '{}' }]) });
    expect(result.statusCode).toBe(200);
    const noOptions = await app.inject({ method: 'POST', url: '/preview', ...body([file]) });
    expect(noOptions.statusCode).toBe(200);
    expect(service.preview.mock.calls[1][1]).toEqual({});
  });

  it('recusa requisição sem multipart e sem arquivo', async () => {
    const json = await app.inject({ method: 'POST', url: '/preview', payload: {} });
    expect(json.statusCode).toBe(400);
    const noFile = await app.inject({ method: 'POST', url: '/preview', ...body([{ name: 'opcoes', value: '{}' }]) });
    expect(noFile.statusCode).toBe(400);
    expect(service.preview).not.toHaveBeenCalled();
  });

  it('recusa arquivo acima do limite e arquivo vazio', async () => {
    const tooLarge = await app.inject({ method: 'POST', url: '/preview', ...body([{ name: 'arquivo', filename: 'relatorio.xls', value: Buffer.alloc(1025) }]) });
    expect(tooLarge.statusCode).toBe(413);
    const empty = await app.inject({ method: 'POST', url: '/preview', ...body([{ name: 'arquivo', filename: 'relatorio.xls', value: '' }]) });
    expect(empty.statusCode).toBe(400);
    expect(service.preview).not.toHaveBeenCalled();
  });

  it('recusa múltiplos arquivos e campos inesperados', async () => {
    const file = { name: 'arquivo', filename: 'relatorio.xls', value: 'conteudo' };
    const twoFiles = await app.inject({ method: 'POST', url: '/preview', ...body([file, file]) });
    expect(twoFiles.statusCode).toBe(400);
    const unknown = await app.inject({ method: 'POST', url: '/preview', ...body([file, { name: 'outro', value: '{}' }]) });
    expect(unknown.statusCode).toBe(400);
    expect(service.preview).not.toHaveBeenCalled();
  });

  it.each(['{inválido', '[]', 'null', 'true'])('recusa opções que não são objeto JSON: %s', async (opcoes) => {
    const result = await app.inject({ method: 'POST', url: '/preview', ...body([
      { name: 'arquivo', filename: 'relatorio.xls', value: 'conteudo' }, { name: 'opcoes', value: opcoes },
    ]) });
    expect(result.statusCode).toBe(400);
    expect(service.preview).not.toHaveBeenCalled();
  });

  it('limita o JSON de opções antes de processar a importação', async () => {
    const result = await app.inject({ method: 'POST', url: '/preview', ...body([
      { name: 'arquivo', filename: 'relatorio.xls', value: 'conteudo' },
      { name: 'opcoes', value: JSON.stringify({ extra: 'x'.repeat(IMPORT_MAX_OPTIONS_BYTES) }) },
    ]) });
    expect(result.statusCode).toBe(413);
    expect(service.preview).not.toHaveBeenCalled();
  });
});

describe('ImportacoesController: autenticação HTTP Nest/Fastify', () => {
  let app: NestFastifyApplication;
  const secret = 'importacoes-test-secret-with-at-least-32-characters';
  const updatedAt = new Date('2026-10-11T00:00:00Z');
  const users = [
    { id: 'admin', email: 'admin@example.com', perfil: PerfilUsuario.ADMIN, ativo: true, updatedAt },
    { id: 'leitor', email: 'leitor@example.com', perfil: PerfilUsuario.USUARIO, ativo: true, updatedAt },
  ];
  const service = { preview: jest.fn().mockResolvedValue({ ok: true }), confirmar: jest.fn().mockResolvedValue({ ok: true }) };
  const config = new ConfigService({ JWT_SECRET: secret, IMPORT_MAX_FILE_BYTES: 2 * 1024 * 1024 });
  const prisma = { user: { findUnique: jest.fn(async ({ where }: any) => users.find((user) => user.id === where.id)) } };
  const jwt = new JwtService({ secret });
  const token = (id: string) => jwt.sign({ sub: id, email: id + '@example.com', version: updatedAt.toISOString() });

  @Module({
    imports: [PassportModule], controllers: [ImportacoesController],
    providers: [
      JwtStrategy, JwtAuthGuard, RolesGuard,
      { provide: ConfigService, useValue: config }, { provide: PrismaService, useValue: prisma },
      { provide: ImportacoesService, useValue: service },
    ],
  })
  class TestModule {}

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter({ bodyLimit: 1_048_576 }), { logger: false });
    await app.register(multipart, { throwFileSizeLimit: true });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => { await app.close(); });

  it.each(['preview', 'confirmar'])('aplica JWT e Admin em /%s antes de processar o arquivo', async (endpoint) => {
    const upload = () => body([{ name: 'arquivo', filename: 'relatorio.xls', value: 'planilha' }]);
    const url = '/importacoes/lancamentos/' + endpoint;
    const anonimo = await app.inject({ method: 'POST', url, ...upload() });
    expect(anonimo.statusCode).toBe(401);
    const leitor = await app.inject({ method: 'POST', url, ...upload(), headers: { ...upload().headers, authorization: 'Bearer ' + token('leitor') } });
    expect(leitor.statusCode).toBe(403);
    const admin = await app.inject({ method: 'POST', url, ...upload(), headers: { ...upload().headers, authorization: 'Bearer ' + token('admin') } });
    expect(admin.statusCode).toBe(201);
    expect(service[endpoint as 'preview' | 'confirmar']).toHaveBeenLastCalledWith(expect.any(Object), {}, expect.objectContaining({ id: 'admin', perfil: PerfilUsuario.ADMIN }));
  });

  it('permite multipart acima do limite JSON quando ainda respeita o limite da planilha', async () => {
    const upload = body([{ name: 'arquivo', filename: 'relatorio.xls', value: Buffer.alloc(1_048_577) }]);
    const result = await app.inject({ method: 'POST', url: '/importacoes/lancamentos/preview', ...upload, headers: { ...upload.headers, authorization: 'Bearer ' + token('admin') } });
    expect(result.statusCode).toBe(201);
  });
});
