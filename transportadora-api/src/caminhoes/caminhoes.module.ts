import { Module } from '@nestjs/common';
import { CaminhoesController } from './caminhoes.controller';
import { CaminhoesService } from './caminhoes.service';
import { ComposicoesCavaloService } from './composicoes-cavalo.service';

@Module({ controllers: [CaminhoesController], providers: [CaminhoesService, ComposicoesCavaloService] })
export class CaminhoesModule {}




