import { Controller } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { CategoriasFinanceirasService } from './categorias-financeiras.service';
import { CreateCategoriaFinanceiraDto } from './dto/create-categoria-financeira.dto';
import { UpdateCategoriaFinanceiraDto } from './dto/update-categoria-financeira.dto';

@Controller('categorias-financeiras')
export class CategoriasFinanceirasController extends CrudController<CreateCategoriaFinanceiraDto, UpdateCategoriaFinanceiraDto> {
  constructor(service: CategoriasFinanceirasService) {
    super(service);
  }
}
