import { StatusGeral, TipoCavaloMecanico } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { normalizePlate, PLATE_MAX_LENGTH } from '../../common/validation/normalize-plate';
import { CreateImplementoDto } from '../../implementos/dto/create-implemento.dto';

export class CreateCaminhaoDto {
  @Transform(({ value }) => normalizePlate(value))
  @IsString() @IsNotEmpty() @MaxLength(PLATE_MAX_LENGTH) placa!: string;
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
