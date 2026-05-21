import { Module } from '@nestjs/common';
import { LancamentosFinanceirosController } from './lancamentos-financeiros.controller';
import { LancamentosFinanceirosService } from './lancamentos-financeiros.service';

@Module({ controllers: [LancamentosFinanceirosController], providers: [LancamentosFinanceirosService] })
export class LancamentosFinanceirosModule {}
