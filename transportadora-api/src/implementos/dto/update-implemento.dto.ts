import { PartialType } from '@nestjs/mapped-types';
import { CreateImplementoDto } from './create-implemento.dto';

export class UpdateImplementoDto extends PartialType(CreateImplementoDto) {}
