import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAbastecimentoDto {
  @IsString() cavaloMecanicoId!: string;
  @Type(() => Date) @IsDate() data!: Date;
  @Type(() => Number) @IsNumber() @Min(0) kmAnterior!: number;
  @Type(() => Number) @IsNumber() @Min(0) kmAtual!: number;
  @Type(() => Number) @IsNumber() @Min(0.001) litros!: number;
  @IsOptional() @IsString() observacoes?: string | null;
}
