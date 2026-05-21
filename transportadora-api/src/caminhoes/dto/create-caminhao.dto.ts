import { StatusGeral } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCaminhaoDto {
  @IsString() @IsNotEmpty() placa!: string;
  @IsOptional() @IsString() marca?: string | null;
  @IsOptional() @IsString() modelo?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1950) @Max(2100) ano?: number | null;
  @IsOptional() @IsString() tipo?: string | null;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsString() chassi?: string;
  @IsOptional() @IsString() renavam?: string;
  @IsOptional() @IsEnum(StatusGeral) status?: StatusGeral | null;
  @IsOptional() @IsString() observacoes?: string;
}
