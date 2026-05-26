import { Controller } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { CreateLancamentoFinanceiroDto } from './dto/create-lancamento-financeiro.dto';
import { UpdateLancamentoFinanceiroDto } from './dto/update-lancamento-financeiro.dto';
import { LancamentosFinanceirosService } from './lancamentos-financeiros.service';

@Controller('lancamentos-financeiros')
export class LancamentosFinanceirosController extends CrudController<CreateLancamentoFinanceiroDto, UpdateLancamentoFinanceiroDto> {
  constructor(service: LancamentosFinanceirosService) {
    super(service);
  }
}




