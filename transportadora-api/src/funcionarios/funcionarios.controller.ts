import { Controller } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { FuncionariosService } from './funcionarios.service';

@Controller('funcionarios')
export class FuncionariosController extends CrudController<CreateFuncionarioDto, UpdateFuncionarioDto> {
  constructor(service: FuncionariosService) {
    super(service);
  }
}
