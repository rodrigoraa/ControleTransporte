import { StatusGeral, TipoCarroceria, TipoImplemento } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateImplementoDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/) placa?: string | null;
  @IsEnum(TipoImplemento) tipo!: TipoImplemento;
  @IsEnum(TipoCarroceria) carroceria!: TipoCarroceria;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) quantidadeEixos?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) capacidadeCarga?: number | null;
  @IsOptional() @IsEnum(StatusGeral) status?: StatusGeral | null;
  @IsOptional() @IsString() observacoes?: string | null;
}
