import { Controller } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { AcompanhamentosService } from './acompanhamentos.service';
import { CreateAcompanhamentoDto } from './dto/create-acompanhamento.dto';
import { UpdateAcompanhamentoDto } from './dto/update-acompanhamento.dto';

@Controller('acompanhamentos')
export class AcompanhamentosController extends CrudController<CreateAcompanhamentoDto, UpdateAcompanhamentoDto> {
  constructor(service: AcompanhamentosService) {
    super(service);
  }
}
