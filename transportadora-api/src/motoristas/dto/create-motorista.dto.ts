import { StatusGeral } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMotoristaDto {
  @IsString() @IsNotEmpty() nome!: string;
  @IsOptional() @IsString() cpf?: string | null;
  @IsOptional() @IsString() cnh?: string | null;
  @IsOptional() @IsString() categoriaCnh?: string | null;
  @IsOptional() @Type(() => Date) @IsDate() validadeCnh?: Date | null;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsEnum(StatusGeral) status?: StatusGeral | null;
  @IsOptional() @IsString() observacoes?: string;
}




