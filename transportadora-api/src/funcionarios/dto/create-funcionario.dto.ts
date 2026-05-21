import { StatusFuncionario } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFuncionarioDto {
  @IsString() @IsNotEmpty() nome!: string;
  @IsString() @IsNotEmpty() cpf!: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() cargo?: string | null;
  @IsOptional() @Type(() => Date) @IsDate() dataAdmissao?: Date | null;
  @IsEnum(StatusFuncionario) status!: StatusFuncionario;
  @IsOptional() @IsString() observacoes?: string;
}
