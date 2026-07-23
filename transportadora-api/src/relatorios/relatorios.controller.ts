import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RelatorioFinanceiroQueryDto } from './dto/relatorio-financeiro-query.dto';
import { RelatoriosService } from './relatorios.service';

@UseGuards(JwtAuthGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly service: RelatoriosService) {}

  @Get('opcoes')
  opcoes() {
    return this.service.opcoes();
  }

  @Get('financeiros')
  financeiros(@Query() query: RelatorioFinanceiroQueryDto) {
    return this.service.financeiros(query);
  }

  @Get('financeiros/exportar.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportarCsv(@Query() query: RelatorioFinanceiroQueryDto) {
    return this.service.exportarCsv(query);
  }

  @Get('financeiros/exportar.pdf')
  async exportarPdf(@Query() query: RelatorioFinanceiroQueryDto, @Res() response: FastifyReply) {
    const pdf = await this.service.exportarPdf(query);
    const filename = query.tipoRelatorio === 'MEDIA_FROTA' ? 'relatorio-media-frota.pdf' : 'registro-geral.pdf';
    return response
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(pdf);
  }
}
