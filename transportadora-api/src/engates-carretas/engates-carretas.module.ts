import { Module } from '@nestjs/common';
import { EngatesCarretasController } from './engates-carretas.controller';
import { EngatesCarretasService } from './engates-carretas.service';

@Module({ controllers: [EngatesCarretasController], providers: [EngatesCarretasService] })
export class EngatesCarretasModule {}
