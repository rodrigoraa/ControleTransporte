import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFornecedorDto {
  @IsString() @IsNotEmpty() nome!: string;
  @IsOptional() @IsString() documento?: string | null;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() endereco?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsBoolean() ativo?: boolean | null;
}




