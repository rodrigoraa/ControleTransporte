import { Module } from '@nestjs/common';
import { ConjuntosController } from './conjuntos.controller';
import { ConjuntosService } from './conjuntos.service';

@Module({ controllers: [ConjuntosController], providers: [ConjuntosService] })
export class ConjuntosModule {}




