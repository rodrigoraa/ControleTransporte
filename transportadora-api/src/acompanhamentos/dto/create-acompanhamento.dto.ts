import { StatusAcompanhamento } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAcompanhamentoDto {
  @IsString() @IsNotEmpty() caminhaoId!: string;
  @IsString() @IsNotEmpty() motoristaId!: string;
  @IsString() @IsNotEmpty() tipoOperacao!: string;
  @IsString() @IsNotEmpty() tipoVeiculo!: string;
  @IsOptional() @Type(() => Date) @IsDate() dataInicio?: Date | null;
  @IsOptional() @Type(() => Date) @IsDate() dataFim?: Date | null;
  @IsOptional() @IsEnum(StatusAcompanhamento) status?: StatusAcompanhamento | null;
  @IsOptional() @IsString() observacoes?: string;
}
