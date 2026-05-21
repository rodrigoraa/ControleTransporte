import { Module } from '@nestjs/common';
import { AcompanhamentosController } from './acompanhamentos.controller';
import { AcompanhamentosService } from './acompanhamentos.service';

@Module({ controllers: [AcompanhamentosController], providers: [AcompanhamentosService] })
export class AcompanhamentosModule {}
