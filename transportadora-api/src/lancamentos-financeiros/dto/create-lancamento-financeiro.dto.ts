import { TipoLancamento, UnidadeQuantidade } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { TipoComissao } from '@prisma/client';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { normalizePlate, PLATE_MAX_LENGTH } from '../../common/validation/normalize-plate';

export class CreateLancamentoFinanceiroDto {
  @Type(() => Date) @IsDate() data!: Date;
  @Transform(({ value }) => normalizePlate(value))
  @IsOptional() @IsString() @MaxLength(PLATE_MAX_LENGTH) placa?: string | null;
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
  @IsOptional() @IsEnum(TipoComissao) tipoComissao?: TipoComissao | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) @Max(100) percentualComissao?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) valorComissaoPorViagem?: number | null;
  @IsOptional() @IsBoolean() descontoImpostos?: boolean;
  @IsOptional() @IsString() observacoes?: string;
}




