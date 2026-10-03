import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';

describe('RelatoriosController HTTP', () => {
  const service = {
    opcoes: jest.fn(async (_query: unknown) => ({ cavalosMecanicos: [] })),
    financeiros: jest.fn(async (_query: unknown) => ({ tipoRelatorio: 'ULTIMAS_MEDIAS_FROTA', ultimasMedias: { registros: [] } })),
    exportarCsv: jest.fn(async (_query: unknown) => '"Placa";"Última média"\n"ABC1A23";"2.920"'),
    exportarPdf: jest.fn(async (_query: unknown) => Buffer.from('%PDF-1.4\nPDF de teste')),
  };
  let app: NestFastifyApplication;

  @Module({
    controllers: [RelatoriosController],
    providers: [{ provide: RelatoriosService, useValue: service }],
  })
  class TestReportModule {}

  beforeAll(async () => {
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    app = await NestFactory.create<NestFastifyApplication>(TestReportModule, new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  it('aceita o novo tipo de relatório sem intervalo de datas e normaliza o filtro de placa', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/relatorios/financeiros?tipoRelatorio=ULTIMAS_MEDIAS_FROTA&placa=abc-1a23&cavaloMecanicoId=cav-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().tipoRelatorio).toBe('ULTIMAS_MEDIAS_FROTA');
    expect(service.financeiros).toHaveBeenCalledWith(expect.objectContaining({
      tipoRelatorio: 'ULTIMAS_MEDIAS_FROTA', placa: 'ABC1A23', cavaloMecanicoId: 'cav-1',
    }));
    const query = service.financeiros.mock.calls[0][0] as any;
    expect(query.dataInicial).toBeUndefined();
    expect(query.dataFinal).toBeUndefined();
  });

  it('aceita o novo tipo na consulta das opções de cavalo', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/relatorios/opcoes?tipoRelatorio=ULTIMAS_MEDIAS_FROTA' });

    expect(response.statusCode).toBe(200);
    expect(service.opcoes).toHaveBeenCalledWith(expect.objectContaining({ tipoRelatorio: 'ULTIMAS_MEDIAS_FROTA' }));
  });

  it('encaminha a seleção de colunas ao CSV e preserva a codificação UTF-8', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/relatorios/financeiros/exportar.csv?tipoRelatorio=ULTIMAS_MEDIAS_FROTA&secoes=ultimas_medias&colunas=ultimas_medias:placa,ultimas_medias:media',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv; charset=utf-8');
    expect(response.body).toContain('Última média');
    expect(service.exportarCsv).toHaveBeenCalledWith(expect.objectContaining({
      tipoRelatorio: 'ULTIMAS_MEDIAS_FROTA', secoes: 'ultimas_medias', colunas: 'ultimas_medias:placa,ultimas_medias:media',
    }));
  });

  it.each([
    ['ULTIMAS_MEDIAS_FROTA', 'relatorio-ultimas-medias-frota.pdf'],
    ['MEDIA_FROTA', 'relatorio-media-frota.pdf'],
    ['RELATORIO_COMBINADO', 'relatorio-financeiro.pdf'],
    ['REGISTRO_GERAL', 'registro-geral.pdf'],
  ])('exporta %s com o nome de arquivo correto', async (reportType, filename) => {
    const response = await app.inject({
      method: 'GET', url: `/api/relatorios/financeiros/exportar.pdf?tipoRelatorio=${reportType}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toBe(`attachment; filename="${filename}"`);
    expect(response.body).toContain('%PDF-1.4');
    expect(service.exportarPdf).toHaveBeenCalledWith(expect.objectContaining({ tipoRelatorio: reportType }));
  });

  it('continua rejeitando tipos e parâmetros desconhecidos antes de chamar o serviço', async () => {
    for (const query of ['tipoRelatorio=INEXISTENTE', 'tipoRelatorio=ULTIMAS_MEDIAS_FROTA&filtroInexistente=1']) {
      const response = await app.inject({ method: 'GET', url: `/api/relatorios/financeiros?${query}` });
      expect(response.statusCode).toBe(400);
    }
    expect(service.financeiros).not.toHaveBeenCalled();
  });
});
