import { CategoriaLancamento, TipoLancamento, UnidadeQuantidade } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLancamentoFinanceiroDto {
  @Type(() => Date) @IsDate() data!: Date;
  @IsString() @IsNotEmpty() placaOuPessoa!: string;
  @IsString() @IsNotEmpty() motoristaId!: string;
  @IsOptional() @IsString() fornecedorId?: string | null;
  @IsOptional() @IsString() caminhaoId?: string | null;
  @IsOptional() @IsString() clienteId?: string | null;
  @IsOptional() @IsString() categoriaId?: string | null;
  @IsEnum(TipoLancamento) tipoLancamento!: TipoLancamento;
  @IsOptional() @IsEnum(CategoriaLancamento) categoria?: CategoriaLancamento | null;
  @IsOptional() @IsString() descricao?: string | null;
  @Type(() => Number) @IsNumber() @Min(0) quantidade!: number;
  @IsEnum(UnidadeQuantidade) unidadeQuantidade!: UnidadeQuantidade;
  @Type(() => Number) @IsNumber() @Min(0) valorUnitario!: number;
  @IsOptional() @IsString() observacoes?: string;
}
