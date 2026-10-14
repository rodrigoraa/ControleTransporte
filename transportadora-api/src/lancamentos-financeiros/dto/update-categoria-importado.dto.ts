import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateCategoriaImportadoDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  categoriaId!: string | null;
}
