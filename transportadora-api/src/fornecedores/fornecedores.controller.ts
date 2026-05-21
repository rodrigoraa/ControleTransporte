import { Controller } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { FornecedoresService } from './fornecedores.service';

@Controller('fornecedores')
export class FornecedoresController extends CrudController<CreateFornecedorDto, UpdateFornecedorDto> {
  constructor(service: FornecedoresService) {
    super(service);
  }
}
