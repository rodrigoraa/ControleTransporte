import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
  financeiros(@Query() query: Record<string, string>) {
    return this.service.financeiros(query);
  }

  @Get('acompanhamentos')
  acompanhamentos(@Query() query: Record<string, string>) {
    return this.service.acompanhamentos(query);
  }
}
