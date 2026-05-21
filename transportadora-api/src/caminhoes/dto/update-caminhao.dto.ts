import { PartialType } from '@nestjs/mapped-types';
import { CreateCaminhaoDto } from './create-caminhao.dto';

export class UpdateCaminhaoDto extends PartialType(CreateCaminhaoDto) {}
