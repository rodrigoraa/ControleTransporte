import { PartialType } from '@nestjs/mapped-types';
import { CreateAbastecimentoDto } from './create-abastecimento.dto';

export class UpdateAbastecimentoDto extends PartialType(CreateAbastecimentoDto) {}
