import { Module } from '@nestjs/common';
import { LancamentosFinanceirosModule } from '../lancamentos-financeiros/lancamentos-financeiros.module';
import { ImportacoesController } from './importacoes.controller';
import { ImportacoesService } from './importacoes.service';
import { PlanilhaLancamentosParser } from './planilha-lancamentos.parser';

@Module({
  imports: [LancamentosFinanceirosModule],
  controllers: [ImportacoesController],
  providers: [ImportacoesService, PlanilhaLancamentosParser],
})
export class ImportacoesModule {}
