import { TipoLancamento, UnidadeQuantidade } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLancamentoFinanceiroDto {
  @Type(() => Date) @IsDate() data!: Date;
  @Transform(({ value }) => (typeof value === 'string' && !value.trim() ? null : typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional() @IsString() placa?: string | null;
  @IsOptional() @IsString() motoristaId?: string | null;
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
  @IsOptional() @IsBoolean() multiplicarQuantidade?: boolean;
  @IsOptional() @IsString() observacoes?: string;
}




