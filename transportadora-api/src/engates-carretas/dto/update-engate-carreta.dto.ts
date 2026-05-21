import { PartialType } from '@nestjs/mapped-types';
import { CreateEngateCarretaDto } from './create-engate-carreta.dto';

export class UpdateEngateCarretaDto extends PartialType(CreateEngateCarretaDto) {}
