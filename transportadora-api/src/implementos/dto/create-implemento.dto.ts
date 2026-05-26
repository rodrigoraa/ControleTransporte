import { StatusGeral, TipoCarroceria, TipoImplemento } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateImplementoDto {
  @IsOptional() @IsString() id?: string;
  @Transform(({ value }) => (typeof value === 'string' && !value.trim() ? null : typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional() @IsString() placa?: string | null;
  @IsEnum(TipoImplemento) tipo!: TipoImplemento;
  @IsEnum(TipoCarroceria) carroceria!: TipoCarroceria;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) quantidadeEixos?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) capacidadeCarga?: number | null;
  @IsOptional() @IsEnum(StatusGeral) status?: StatusGeral | null;
  @IsOptional() @IsString() observacoes?: string | null;
}




