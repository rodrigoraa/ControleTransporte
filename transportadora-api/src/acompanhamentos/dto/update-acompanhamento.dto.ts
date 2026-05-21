import { PartialType } from '@nestjs/mapped-types';
import { CreateAcompanhamentoDto } from './create-acompanhamento.dto';

export class UpdateAcompanhamentoDto extends PartialType(CreateAcompanhamentoDto) {}
