import { PartialType } from '@nestjs/mapped-types';
import { CreateLancamentoFinanceiroDto } from './create-lancamento-financeiro.dto';

export class UpdateLancamentoFinanceiroDto extends PartialType(CreateLancamentoFinanceiroDto) {}




