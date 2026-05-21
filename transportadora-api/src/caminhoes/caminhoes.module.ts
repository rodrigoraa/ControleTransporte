import { Module } from '@nestjs/common';
import { CaminhoesController } from './caminhoes.controller';
import { CaminhoesService } from './caminhoes.service';

@Module({ controllers: [CaminhoesController], providers: [CaminhoesService] })
export class CaminhoesModule {}
