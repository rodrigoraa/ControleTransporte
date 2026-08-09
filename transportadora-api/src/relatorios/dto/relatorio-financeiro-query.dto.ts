import { TipoConjuntoOperacional, TipoLancamento } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { normalizePlate, PLATE_MAX_LENGTH } from '../../common/validation/normalize-plate';

export class RelatorioFinanceiroQueryDto {
  @IsOptional() @IsIn(['REGISTRO_GERAL', 'RELATORIO_COMBINADO', 'MEDIA_FROTA']) tipoRelatorio?: 'REGISTRO_GERAL' | 'RELATORIO_COMBINADO' | 'MEDIA_FROTA';
  @IsOptional() @IsDateString() dataInicial?: string;
  @IsOptional() @IsDateString() dataFinal?: string;
  @IsOptional() @IsString() motoristaId?: string;
  @IsOptional() @IsString() motoristaIds?: string;
  @IsOptional() @IsString() cavaloMecanicoId?: string;
  @IsOptional() @IsString() cavaloMecanicoIds?: string;
  @IsOptional() @IsString() implementoId?: string;
  @IsOptional() @IsString() implementoIds?: string;
  @IsOptional() @IsString() conjuntoId?: string;
  @IsOptional() @IsString() conjuntoIds?: string;
  @IsOptional() @IsString() fornecedorId?: string;
  @IsOptional() @IsString() fornecedorIds?: string;
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsString() clienteIds?: string;
  @IsOptional() @IsString() categoriaId?: string;
  @IsOptional() @IsString() categoriaIds?: string;
  @IsOptional() @IsEnum(TipoLancamento) tipoLancamento?: TipoLancamento;
  @IsOptional() @IsString() @Matches(/^(DESPESA|FATURAMENTO)(,(DESPESA|FATURAMENTO))*$/) tiposLancamento?: string;
  @IsOptional() @IsEnum(TipoConjuntoOperacional) tipoConjunto?: TipoConjuntoOperacional;
  @IsOptional() @IsString() @Matches(/^(SIMPLES|BITREM|RODOTREM|OUTRO)(,(SIMPLES|BITREM|RODOTREM|OUTRO))*$/) tiposConjunto?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20) quantidadeEixos?: number;
  @IsOptional() @IsString() @Matches(/^([0-9]|1[0-9]|20)(,([0-9]|1[0-9]|20))*$/) quantidadesEixos?: string;
  @Transform(({ value }) => normalizePlate(value))
  @IsOptional() @IsString() @MaxLength(PLATE_MAX_LENGTH) placa?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
  @IsOptional()
  @IsIn(['data', 'tipoLancamento', 'cavalo', 'conjunto', 'motorista', 'parte', 'categoria', 'quantidade', 'valorUnitario', 'valorTotal'])
  orderBy?: 'data' | 'tipoLancamento' | 'cavalo' | 'conjunto' | 'motorista' | 'parte' | 'categoria' | 'quantidade' | 'valorUnitario' | 'valorTotal';
  @IsOptional() @IsIn(['asc', 'desc']) orderDirection?: 'asc' | 'desc';
  @IsOptional() @IsString() secoesPdf?: string;
  @IsOptional() @IsString() colunasPdf?: string;
}




