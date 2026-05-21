import { StatusAcompanhamento } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateEngateCarretaDto {
  @IsString() @IsNotEmpty() cavaloId!: string;
  @IsOptional() @IsString() carreta1Id?: string | null;
  @IsOptional() @IsString() carreta2Id?: string | null;
  @IsOptional() @IsString() motoristaId?: string | null;
  @Type(() => Date) @IsDate() dataInicio!: Date;
  @IsOptional() @Type(() => Date) @IsDate() dataFim?: Date | null;
  @IsOptional() @IsEnum(StatusAcompanhamento) status?: StatusAcompanhamento;
  @IsOptional() @IsString() observacoes?: string | null;
}
