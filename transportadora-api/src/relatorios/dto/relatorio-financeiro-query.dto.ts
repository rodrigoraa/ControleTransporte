import { TipoConjuntoOperacional, TipoLancamento } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RelatorioFinanceiroQueryDto {
  @IsOptional() @IsIn(['REGISTRO_GERAL', 'MEDIA_FROTA']) tipoRelatorio?: 'REGISTRO_GERAL' | 'MEDIA_FROTA';
  @IsOptional() @IsDateString() dataInicial?: string;
  @IsOptional() @IsDateString() dataFinal?: string;
  @IsOptional() @IsString() motoristaId?: string;
  @IsOptional() @IsString() cavaloMecanicoId?: string;
  @IsOptional() @IsString() implementoId?: string;
  @IsOptional() @IsString() conjuntoId?: string;
  @IsOptional() @IsString() fornecedorId?: string;
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsString() categoriaId?: string;
  @IsOptional() @IsEnum(TipoLancamento) tipoLancamento?: TipoLancamento;
  @IsOptional() @IsEnum(TipoConjuntoOperacional) tipoConjunto?: TipoConjuntoOperacional;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20) quantidadeEixos?: number;
  @IsOptional() @IsString() placa?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
  @IsOptional() @IsIn(['data', 'valorTotal']) orderBy?: 'data' | 'valorTotal';
  @IsOptional() @IsIn(['asc', 'desc']) orderDirection?: 'asc' | 'desc';
  @IsOptional() @IsString() secoesPdf?: string;
  @IsOptional() @IsString() colunasPdf?: string;
}




