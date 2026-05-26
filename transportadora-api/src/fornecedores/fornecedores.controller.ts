import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { FornecedoresService } from './fornecedores.service';

@Controller('fornecedores')
export class FornecedoresController extends CrudController<CreateFornecedorDto, UpdateFornecedorDto> {
  constructor(service: FornecedoresService) {
    super(service);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/historico')
  historico(@Param('id') id: string) {
    return this.service.historico(id);
  }
}




