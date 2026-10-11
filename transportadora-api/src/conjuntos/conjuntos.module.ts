import { Module } from '@nestjs/common';
import { ComposicoesCavaloService } from '../caminhoes/composicoes-cavalo.service';
import { ConjuntosController } from './conjuntos.controller';
import { ConjuntosService } from './conjuntos.service';

@Module({ controllers: [ConjuntosController], providers: [ConjuntosService, ComposicoesCavaloService] })
export class ConjuntosModule {}




