import { PartialType } from '@nestjs/mapped-types';
import { CreateConjuntoDto } from './create-conjunto.dto';

export class UpdateConjuntoDto extends PartialType(CreateConjuntoDto) {}




