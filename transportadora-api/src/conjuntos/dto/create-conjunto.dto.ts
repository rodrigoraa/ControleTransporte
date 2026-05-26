import { StatusGeral, TipoConjuntoOperacional } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateConjuntoDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsEnum(TipoConjuntoOperacional) tipo?: TipoConjuntoOperacional;
  @IsString() @IsNotEmpty() cavaloMecanicoId!: string;
  @IsArray() @IsString({ each: true }) implementoIds!: string[];
  @IsOptional() @IsEnum(StatusGeral) status?: StatusGeral | null;
  @IsOptional() @IsString() justificativaSemImplemento?: string | null;
  @IsOptional() @IsString() observacoes?: string | null;
}




