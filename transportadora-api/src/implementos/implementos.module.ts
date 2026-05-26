import { Module } from '@nestjs/common';
import { ImplementosController } from './implementos.controller';
import { ImplementosService } from './implementos.service';

@Module({
  controllers: [ImplementosController],
  providers: [ImplementosService],
})
export class ImplementosModule {}




