import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '../../common/crud/pagination.dto';

export class AbastecimentosQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kmAnterior?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kmAtual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanciaPercorrida?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  litros?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mediaKmLitro?: number;
}
