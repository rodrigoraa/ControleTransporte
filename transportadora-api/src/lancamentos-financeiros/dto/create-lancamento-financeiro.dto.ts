import { TipoLancamento, UnidadeQuantidade } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateLancamentoFinanceiroDto {
  @Type(() => Date) @IsDate() data!: Date;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/) placa?: string | null;
  @IsString() @IsNotEmpty() motoristaId!: string;
  @IsOptional() @IsString() fornecedorId?: string | null;
  @IsOptional() @IsString() caminhaoId?: string | null;
  @IsOptional() @IsString() cavaloMecanicoId?: string | null;
  @IsOptional() @IsString() conjuntoId?: string | null;
  @IsOptional() @IsString() implementoId?: string | null;
  @IsOptional() @IsString() clienteId?: string | null;
  @IsOptional() @IsString() categoriaId?: string | null;
  @IsEnum(TipoLancamento) tipoLancamento!: TipoLancamento;
  @IsOptional() @IsString() descricao?: string | null;
  @Type(() => Number) @IsNumber() @Min(0) quantidade!: number;
  @IsEnum(UnidadeQuantidade) unidadeQuantidade!: UnidadeQuantidade;
  @Type(() => Number) @IsNumber() @Min(0) valorUnitario!: number;
  @IsOptional() @IsString() observacoes?: string;
}
