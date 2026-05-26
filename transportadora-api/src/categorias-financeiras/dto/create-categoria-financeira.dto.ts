import { TipoLancamento } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoriaFinanceiraDto {
  @IsString() @IsNotEmpty() nome!: string;
  @IsOptional() @IsEnum(TipoLancamento) tipoLancamento?: TipoLancamento | null;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() observacoes?: string | null;
}




