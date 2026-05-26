import { StatusGeral, TipoCavaloMecanico } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { CreateImplementoDto } from '../../implementos/dto/create-implemento.dto';

export class CreateCaminhaoDto {
  @IsString() @IsNotEmpty() @Matches(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/) placa!: string;
  @IsOptional() @IsString() marca?: string | null;
  @IsOptional() @IsString() modelo?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1950) @Max(2100) ano?: number | null;
  @IsOptional() @IsEnum(TipoCavaloMecanico) tipoCavalo?: TipoCavaloMecanico | null;
  @IsOptional() @IsString() motoristaId?: string | null;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsString() chassi?: string;
  @IsOptional() @IsString() renavam?: string;
  @IsOptional() @IsEnum(StatusGeral) status?: StatusGeral | null;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateImplementoDto) implementos?: CreateImplementoDto[];
  @IsOptional() @IsEnum(StatusGeral) conjuntoStatus?: StatusGeral | null;
  @IsOptional() @IsString() conjuntoObservacoes?: string | null;
}
